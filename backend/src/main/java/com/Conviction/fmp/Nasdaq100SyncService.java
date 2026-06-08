package com.conviction.fmp;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.conviction.financials.FinancialsSyncService;
import com.conviction.fmp.FMPKeyMetricsSync.FMPKeyMetricsResponse;
import com.conviction.holding.service.HoldingService;

/**
 * Background batch sync of all NASDAQ-100 constituents.
 *
 * Per-symbol: profile → key metrics → historical prices → financials (annual + quarterly).
 * Throttled to ~3 FMP calls/second to stay well under the 300/min plan cap.
 * One run at a time (AtomicBoolean guard); progress is tracked in-memory.
 */
@Service
public class Nasdaq100SyncService {

    private static final Logger log = LoggerFactory.getLogger(Nasdaq100SyncService.class);

    // ms to sleep between each top-level sync call within a symbol (~3 calls/sec)
    private static final long THROTTLE_MS = 350;

    // Fallback list if the FMP constituents endpoint is unavailable on the current plan
    private static final List<String> FALLBACK_SYMBOLS = List.of(
        "AAPL","MSFT","NVDA","AMZN","META","TSLA","GOOGL","GOOG","AVGO","COST",
        "NFLX","AMD","QCOM","TMUS","ADBE","CSCO","PEP","INTC","INTU","TXN",
        "AMGN","AMAT","ISRG","BKNG","MU","LRCX","KLAC","PANW","REGN","SNPS",
        "CDNS","CRWD","MRVL","ADI","ABNB","MELI","ASML","FTNT","ORLY","CTAS",
        "MDLZ","PCAR","MNST","PAYX","ROST","DXCM","ADP","CPRT","NXPI","KHC",
        "ODFL","BIIB","FAST","IDXX","CTSH","VRSK","ILMN","GEHC","DDOG","ON",
        "CDW","SIRI","TEAM","ANSS","WDAY","XEL","DLTR","GFS","WBA","FANG",
        "LCID","ZS","ALGN","ENPH","ZM","OKTA","DOCU","PTON","RIVN","WBD",
        "CEG","EXC","TROW","SPLK","CINF","CHKP","SWKS","NTAP","VRSN","HOLX",
        "GILD","MRNA","TTWO","EA","MTCH","FOX","FOXA","PARA","NWSA","NWS"
    );

    private final FMPClient fmp;
    private final FMPProfileSync profileSync;
    private final FMPKeyMetricsSync keyMetricsSync;
    private final FMPHistoricalPriceSync historicalSync;
    private final YahooHistoricalPriceSync yahooSync;
    private final FinancialsSyncService financialsSync;
    private final HoldingService holdingService;

    // ── in-memory job state ───────────────────────────────────────────────────
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile JobStatus currentStatus = new JobStatus("idle", 0, 0, null, List.of(), null);

    public Nasdaq100SyncService(
            FMPClient fmp,
            FMPProfileSync profileSync,
            FMPKeyMetricsSync keyMetricsSync,
            FMPHistoricalPriceSync historicalSync,
            YahooHistoricalPriceSync yahooSync,
            FinancialsSyncService financialsSync,
            HoldingService holdingService) {
        this.fmp            = fmp;
        this.profileSync    = profileSync;
        this.keyMetricsSync = keyMetricsSync;
        this.historicalSync = historicalSync;
        this.yahooSync      = yahooSync;
        this.financialsSync = financialsSync;
        this.holdingService = holdingService;
    }

    /** Returns false if a job is already running (caller should surface this to the user). */
    public boolean requestStart() {
        return running.compareAndSet(false, true);
    }

    public JobStatus getStatus() {
        return currentStatus;
    }

    /**
     * Run the full NASDAQ-100 batch sync in the background.
     * Called only after requestStart() returns true.
     */
    @Async("nasdaq100Executor")
    public void runSync() {
        List<String> symbols = fetchNasdaq100Symbols();
        int total = symbols.size();
        List<String> failures = new ArrayList<>();

        currentStatus = new JobStatus("running", 0, total, symbols.isEmpty() ? null : symbols.get(0), List.of(), null);
        log.info("NASDAQ-100 batch sync started — {} symbols", total);

        for (int idx = 0; idx < symbols.size(); idx++) {
            String sym = symbols.get(idx);
            currentStatus = new JobStatus("running", idx, total, sym, List.copyOf(failures), null);

            try {
                // 1. Profile (~1 FMP call)
                profileSync.sync(sym);
                throttle();

                // 2. Key metrics (~1 FMP call)
                keyMetricsSync.sync(sym);
                throttle();

                // 3. Historical prices — try FMP first, fall back to Yahoo (~1 FMP call)
                var prices = historicalSync.syncFull(sym);
                if (prices.isEmpty()) prices = historicalSync.syncFull(sym.replace('.', '-'));
                if (prices.isEmpty()) yahooSync.syncFull(sym);
                throttle();

                // 4. Financials: annual + quarterly (~9 FMP calls, each internally called with throttle spacing)
                // We let FinancialsSyncService make its own FMP calls; throttle between each statement call
                // by sleeping before invoking (each fetch() inside syncSymbol is a separate FMP call).
                // The bulk of the rate budget is here — syncSymbol makes ~9 calls internally.
                // We add a longer pause after financials to keep the rolling average safe.
                financialsSync.syncSymbol(sym);
                Thread.sleep(2000); // generous pause after the ~9-call financials block

                // Refresh holding prices if this symbol is in the portfolio
                holdingService.refreshPricesForSymbol(sym);

                log.info("NASDAQ-100 sync: [{}/{}] {} ✓", idx + 1, total, sym);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("NASDAQ-100 sync interrupted at symbol {}", sym);
                failures.add(sym + " (interrupted)");
                break;
            } catch (Exception e) {
                log.warn("NASDAQ-100 sync: [{}/{}] {} FAILED — {}", idx + 1, total, sym, e.getMessage());
                failures.add(sym);
            }
        }

        String summary = failures.isEmpty()
            ? String.format("Synced %d/%d symbols", total - failures.size(), total)
            : String.format("Synced %d/%d — %d failed: %s",
                total - failures.size(), total, failures.size(), String.join(", ", failures));

        currentStatus = new JobStatus("completed", total, total, null, List.copyOf(failures), summary);
        running.set(false);
        log.info("NASDAQ-100 batch sync completed. {}", summary);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<String> fetchNasdaq100Symbols() {
        try {
            List<Map<String, Object>> constituents = fmp.get(
                "/nasdaq-constituents", List.class);
            if (constituents != null && !constituents.isEmpty()) {
                List<String> syms = constituents.stream()
                    .map(m -> m.get("symbol"))
                    .filter(s -> s != null)
                    .map(Object::toString)
                    .toList();
                log.info("Fetched {} NASDAQ-100 constituents from FMP", syms.size());
                return syms;
            }
        } catch (Exception e) {
            log.warn("Failed to fetch NASDAQ-100 constituents from FMP: {} — using fallback list", e.getMessage());
        }
        log.info("Using fallback NASDAQ-100 symbol list ({} symbols)", FALLBACK_SYMBOLS.size());
        return FALLBACK_SYMBOLS;
    }

    private void throttle() throws InterruptedException {
        Thread.sleep(THROTTLE_MS);
    }

    // ── status record ─────────────────────────────────────────────────────────

    public record JobStatus(
        String state,          // "idle" | "running" | "completed" | "failed"
        int completed,
        int total,
        String currentSymbol,
        List<String> failures,
        String summary         // non-null when completed
    ) {}
}
