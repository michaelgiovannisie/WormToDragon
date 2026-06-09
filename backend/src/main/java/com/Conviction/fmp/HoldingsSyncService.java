package com.conviction.fmp;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.conviction.financials.FinancialsSyncService;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.holding.service.HoldingService;

/**
 * Background sync of all active held symbols (profile + key metrics + 3-month prices + financials).
 * Same pattern as Nasdaq100SyncService — one run at a time, progress tracked in-memory.
 */
@Service
public class HoldingsSyncService {

    private static final Logger log = LoggerFactory.getLogger(HoldingsSyncService.class);
    private static final long THROTTLE_MS = 150;

    private final HoldingRepository holdingRepository;
    private final FMPProfileSync profileSync;
    private final FMPKeyMetricsSync keyMetricsSync;
    private final FMPHistoricalPriceSync historicalSync;
    private final YahooHistoricalPriceSync yahooSync;
    private final FinancialsSyncService financialsSync;
    private final HoldingService holdingService;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile JobStatus currentStatus = new JobStatus("idle", 0, 0, null, List.of(), null);

    public HoldingsSyncService(
            HoldingRepository holdingRepository,
            FMPProfileSync profileSync,
            FMPKeyMetricsSync keyMetricsSync,
            FMPHistoricalPriceSync historicalSync,
            YahooHistoricalPriceSync yahooSync,
            FinancialsSyncService financialsSync,
            HoldingService holdingService) {
        this.holdingRepository = holdingRepository;
        this.profileSync       = profileSync;
        this.keyMetricsSync    = keyMetricsSync;
        this.historicalSync    = historicalSync;
        this.yahooSync         = yahooSync;
        this.financialsSync    = financialsSync;
        this.holdingService    = holdingService;
    }

    /** Returns false if a job is already running. */
    public boolean requestStart() {
        return running.compareAndSet(false, true);
    }

    public JobStatus getStatus() {
        return currentStatus;
    }

    @Async("nasdaq100Executor")
    public void runSync() {
        List<String> symbols = holdingRepository.findActiveSymbols();
        int total = symbols.size();
        List<String> failures = new ArrayList<>();

        currentStatus = new JobStatus("running", 0, total, symbols.isEmpty() ? null : symbols.get(0), List.of(), null);
        log.info("Holdings sync started — {} symbols", total);

        for (int idx = 0; idx < symbols.size(); idx++) {
            String sym = symbols.get(idx);
            currentStatus = new JobStatus("running", idx, total, sym, List.copyOf(failures), null);

            try {
                profileSync.sync(sym);
                throttle();

                keyMetricsSync.sync(sym);
                throttle();

                // 3-month top-up — full history assumed already loaded
                LocalDate threeMonthsAgo = LocalDate.now().minusMonths(3);
                var prices = historicalSync.sync(sym, threeMonthsAgo, null);
                if (prices.isEmpty()) prices = historicalSync.sync(sym.replace('.', '-'), threeMonthsAgo, null);
                if (prices.isEmpty()) yahooSync.syncFull(sym);
                throttle();

                financialsSync.syncSymbol(sym);
                Thread.sleep(1000);

                holdingService.refreshPricesForSymbol(sym);

                log.info("Holdings sync: [{}/{}] {} ✓", idx + 1, total, sym);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Holdings sync interrupted at {}", sym);
                failures.add(sym + " (interrupted)");
                break;
            } catch (Exception e) {
                log.warn("Holdings sync: [{}/{}] {} FAILED — {}", idx + 1, total, sym, e.getMessage());
                failures.add(sym);
            }
        }

        String summary = failures.isEmpty()
            ? String.format("Synced %d/%d holdings", total - failures.size(), total)
            : String.format("Synced %d/%d — failed: %s",
                total - failures.size(), total, String.join(", ", failures));

        currentStatus = new JobStatus("completed", total, total, null, List.copyOf(failures), summary);
        running.set(false);
        log.info("Holdings sync completed. {}", summary);
    }

    private void throttle() throws InterruptedException {
        Thread.sleep(THROTTLE_MS);
    }

    public record JobStatus(
        String state,
        int completed,
        int total,
        String currentSymbol,
        List<String> failures,
        String summary
    ) {}
}
