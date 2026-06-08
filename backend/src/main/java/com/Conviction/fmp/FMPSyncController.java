package com.conviction.fmp;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.holding.repository.HoldingRepository;

import com.conviction.asset.dto.AssetResponse;
import com.conviction.fmp.FMPKeyMetricsSync.FMPKeyMetricsResponse;
import com.conviction.historicalprice.dto.HistoricalPriceResponse;
import com.conviction.holding.service.HoldingService;

@RestController
@RequestMapping("/api/fmp")
public class FMPSyncController {

    private final FMPHistoricalPriceSync historicalSync;
    private final FMPProfileSync profileSync;
    private final FMPKeyMetricsSync keyMetricsSync;
    private final YahooHistoricalPriceSync yahooSync;
    private final HoldingService holdingService;
    private final HoldingRepository holdingRepository;
    private final Nasdaq100SyncService nasdaq100SyncService;

    public FMPSyncController(
            FMPHistoricalPriceSync historicalSync,
            FMPProfileSync profileSync,
            FMPKeyMetricsSync keyMetricsSync,
            YahooHistoricalPriceSync yahooSync,
            HoldingService holdingService,
            HoldingRepository holdingRepository,
            Nasdaq100SyncService nasdaq100SyncService
    ) {
        this.historicalSync       = historicalSync;
        this.profileSync          = profileSync;
        this.keyMetricsSync       = keyMetricsSync;
        this.yahooSync            = yahooSync;
        this.holdingService       = holdingService;
        this.holdingRepository    = holdingRepository;
        this.nasdaq100SyncService = nasdaq100SyncService;
    }

    /** Fetch and store EOD OHLCV history. Optional from/to to limit range. */
    @PostMapping("/{symbol}/sync-history")
    public org.springframework.http.ResponseEntity<?> syncHistory(
            @PathVariable String symbol,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        try {
            return org.springframework.http.ResponseEntity.ok(historicalSync.sync(symbol.toUpperCase(), from, to));
        } catch (Exception e) {
            return org.springframework.http.ResponseEntity.status(500).body(e.getMessage() + (e.getCause() != null ? " | cause: " + e.getCause().getMessage() : ""));
        }
    }

    /** Fetch company profile and update asset name, exchange, sector, industry, marketCap, P/E. */
    @PostMapping("/{symbol}/sync-profile")
    public AssetResponse syncProfile(@PathVariable String symbol) {
        return profileSync.sync(symbol.toUpperCase());
    }

    /** Fetch TTM key metrics, update EPS + P/E on the asset, return metrics for valuation pre-fill. */
    @PostMapping("/{symbol}/sync-metrics")
    public FMPKeyMetricsResponse syncMetrics(@PathVariable String symbol) {
        return keyMetricsSync.sync(symbol.toUpperCase());
    }

    /** Convenience: run all 3 syncs in sequence, then refresh holding market prices. Falls back to Yahoo if FMP has no data. */
    @PostMapping("/{symbol}/sync-all")
    public FMPSyncAllResponse syncAll(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();
        AssetResponse profile = profileSync.sync(sym);
        FMPKeyMetricsResponse metrics = keyMetricsSync.sync(sym);
        List<HistoricalPriceResponse> prices = historicalSync.syncFull(sym);
        // FMP may also accept hyphen variant for class shares (BRK.A → BRK-A)
        if (prices.isEmpty()) prices = historicalSync.syncFull(sym.replace('.', '-'));
        if (prices.isEmpty()) prices = yahooSync.syncFull(sym);
        int holdingsUpdated = holdingService.refreshPricesForSymbol(sym);
        return new FMPSyncAllResponse(sym, profile, metrics, prices.size(), holdingsUpdated);
    }

    /** Sync all active holdings at once — profile + metrics + history + price refresh for each symbol. */
    @PostMapping("/sync-all-holdings")
    public List<FMPSyncAllResponse> syncAllHoldings() {
        List<String> symbols = holdingRepository.findActiveSymbols();

        List<FMPSyncAllResponse> results = new ArrayList<>();
        for (String sym : symbols) {
            try {
                AssetResponse profile = profileSync.sync(sym);
                FMPKeyMetricsResponse metrics = keyMetricsSync.sync(sym);
                List<HistoricalPriceResponse> prices = historicalSync.syncFull(sym);
                if (prices.isEmpty()) prices = yahooSync.syncFull(sym);
                int holdingsUpdated = holdingService.refreshPricesForSymbol(sym);
                results.add(new FMPSyncAllResponse(sym, profile, metrics, prices.size(), holdingsUpdated));
            } catch (Exception e) {
                results.add(new FMPSyncAllResponse(sym, null, null, 0, 0));
            }
        }
        return results;
    }

    public record FMPSyncAllResponse(
            String symbol,
            AssetResponse profile,
            FMPKeyMetricsResponse metrics,
            int historicalPricesSynced,
            int holdingsUpdated
    ) {}

    // ── NASDAQ-100 batch sync ─────────────────────────────────────────────────

    /**
     * Start the NASDAQ-100 background batch sync.
     * Returns 202 Accepted if the job was started, or 409 Conflict if one is already running.
     */
    @PostMapping("/sync-nasdaq100")
    public ResponseEntity<Nasdaq100SyncService.JobStatus> startNasdaq100Sync() {
        boolean started = nasdaq100SyncService.requestStart();
        if (!started) {
            // Already running — return current status with 409
            return ResponseEntity.status(409).body(nasdaq100SyncService.getStatus());
        }
        // Fire the async method and return immediately
        nasdaq100SyncService.runSync();
        return ResponseEntity.accepted().body(nasdaq100SyncService.getStatus());
    }

    /** Poll for NASDAQ-100 batch sync progress. */
    @GetMapping("/sync-nasdaq100/status")
    public Nasdaq100SyncService.JobStatus getNasdaq100SyncStatus() {
        return nasdaq100SyncService.getStatus();
    }
}
