package com.conviction.fmp;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.asset.dto.AssetResponse;
import com.conviction.fmp.FMPKeyMetricsSync.FMPKeyMetricsResponse;
import com.conviction.historicalprice.dto.HistoricalPriceResponse;

@RestController
@RequestMapping("/api/fmp")
public class FMPSyncController {

    private final FMPHistoricalPriceSync historicalSync;
    private final FMPProfileSync profileSync;
    private final FMPKeyMetricsSync keyMetricsSync;

    public FMPSyncController(
            FMPHistoricalPriceSync historicalSync,
            FMPProfileSync profileSync,
            FMPKeyMetricsSync keyMetricsSync
    ) {
        this.historicalSync = historicalSync;
        this.profileSync = profileSync;
        this.keyMetricsSync = keyMetricsSync;
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

    /** Convenience: run all 3 syncs in sequence. */
    @PostMapping("/{symbol}/sync-all")
    public FMPSyncAllResponse syncAll(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();
        AssetResponse profile = profileSync.sync(sym);
        FMPKeyMetricsResponse metrics = keyMetricsSync.sync(sym);
        List<HistoricalPriceResponse> prices = historicalSync.syncFull(sym);
        return new FMPSyncAllResponse(sym, profile, metrics, prices.size());
    }

    public record FMPSyncAllResponse(
            String symbol,
            AssetResponse profile,
            FMPKeyMetricsResponse metrics,
            int historicalPricesSynced
    ) {}
}
