package com.conviction.fmp;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.asset.dto.AssetResponse;
import com.conviction.asset.dto.CreateAssetRequest;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.entity.Equity;
import com.conviction.asset.entity.ETF;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.asset.service.AssetService;

@RestController
@RequestMapping("/api/fmp")
public class FMPDiscoverController {

    private final FMPClient fmp;
    private final AssetRepository assetRepository;
    private final AssetService assetService;
    private final FMPProfileSync profileSync;
    private final FMPKeyMetricsSync keyMetricsSync;

    public FMPDiscoverController(
            FMPClient fmp,
            AssetRepository assetRepository,
            AssetService assetService,
            FMPProfileSync profileSync,
            FMPKeyMetricsSync keyMetricsSync
    ) {
        this.fmp = fmp;
        this.assetRepository = assetRepository;
        this.assetService = assetService;
        this.profileSync = profileSync;
        this.keyMetricsSync = keyMetricsSync;
    }

    /** Search FMP's full symbol universe — no local DB required. */
    @SuppressWarnings("unchecked")
    @GetMapping("/search")
    public List<FMPSearchResult> search(@RequestParam String query) {
        // Try symbol search first, fall back to name search, merge results
        List<Map<String, Object>> bySymbol = fetch("/search-symbol", "query", query);
        List<Map<String, Object>> byName   = fetch("/search-name",   "query", query);

        // Merge, deduplicate by symbol
        var seen = new java.util.LinkedHashSet<String>();
        var merged = new java.util.ArrayList<FMPSearchResult>();
        for (Map<String, Object> r : bySymbol) {
            String sym = str(r, "symbol");
            if (sym != null && seen.add(sym)) merged.add(toSearchResult(r));
        }
        for (Map<String, Object> r : byName) {
            String sym = str(r, "symbol");
            if (sym != null && seen.add(sym)) merged.add(toSearchResult(r));
        }
        return merged.stream().limit(30).toList();
    }

    /** Company screener — filter by sector, exchange, marketCapMoreThan, etc. */
    @SuppressWarnings("unchecked")
    @GetMapping("/screener")
    public List<FMPScreenerResult> screener(
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) String exchange,
            @RequestParam(required = false) Long marketCapMoreThan,
            @RequestParam(required = false) Long marketCapLessThan,
            @RequestParam(defaultValue = "20") int limit
    ) {
        var params = new java.util.ArrayList<String>();
        if (sector           != null) { params.add("sector");            params.add(sector); }
        if (exchange         != null) { params.add("exchange");          params.add(exchange); }
        if (marketCapMoreThan != null) { params.add("marketCapMoreThan"); params.add(marketCapMoreThan.toString()); }
        if (marketCapLessThan != null) { params.add("marketCapLessThan"); params.add(marketCapLessThan.toString()); }
        params.add("limit"); params.add(String.valueOf(Math.min(limit, 50)));

        List<Map<String, Object>> result = fmp.get("/company-screener", List.class, params.toArray(new String[0]));
        if (result == null) return List.of();
        return result.stream().map(this::toScreenerResult).toList();
    }

    /**
     * Preview a symbol's FMP profile without adding to local DB.
     * Returns null fields for anything FMP doesn't return.
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/preview/{symbol}")
    public FMPPreviewResult preview(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();
        List<Map<String, Object>> result = fmp.get("/profile", List.class, "symbol", sym);
        boolean inLibrary = assetRepository.existsBySymbol(sym);
        if (result == null || result.isEmpty()) {
            return new FMPPreviewResult(sym, null, null, null, null, null, null, null, null, null, inLibrary);
        }
        Map<String, Object> p = result.get(0);
        boolean isEtf = Boolean.TRUE.equals(p.get("isEtf"));
        return new FMPPreviewResult(
                sym,
                str(p, "companyName"),
                isEtf ? "ETF" : "EQUITY",
                str(p, "exchangeShortName"),
                str(p, "currency"),
                str(p, "sector"),
                str(p, "industry"),
                toBD(p.get("mktCap")),
                toBD(p.get("pe")),
                toBD(p.get("price")),
                inLibrary
        );
    }

    /**
     * Add a symbol to the local Asset library.
     * Fetches profile from FMP, picks Equity/ETF subtype, runs profile + metrics sync.
     * Idempotent — if the asset already exists, just re-syncs and returns it.
     */
    @PostMapping("/add-to-library/{symbol}")
    public AssetResponse addToLibrary(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();

        if (assetRepository.existsBySymbol(sym)) {
            // Already in library — re-sync profile & metrics and return
            profileSync.sync(sym);
            keyMetricsSync.sync(sym);
            return assetService.toResponse(assetRepository.findBySymbol(sym).get());
        }

        // Determine subtype from FMP profile
        String assetType = resolveAssetType(sym);

        CreateAssetRequest req = new CreateAssetRequest(sym, sym, assetType, null, "USD");
        AssetResponse created = assetService.createAsset(req);

        // Sync full profile + metrics into the newly created row
        profileSync.sync(sym);
        keyMetricsSync.sync(sym);

        return assetService.toResponse(assetRepository.findBySymbol(sym).get());
    }

    @SuppressWarnings("unchecked")
    private String resolveAssetType(String symbol) {
        List<Map<String, Object>> result = fmp.get("/profile", List.class, "symbol", symbol);
        if (result == null || result.isEmpty()) return "EQUITY";
        Map<String, Object> p = result.get(0);
        if (Boolean.TRUE.equals(p.get("isEtf"))) return "ETF";
        String sector = str(p, "sector");
        // Crypto typically has no sector and a specific exchange
        if (sector == null || sector.isBlank()) {
            String exchange = str(p, "exchangeShortName");
            if ("CRYPTO".equalsIgnoreCase(exchange) || "COINBASE".equalsIgnoreCase(exchange)) return "CRYPTO";
        }
        return "EQUITY";
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetch(String path, String... params) {
        List<Map<String, Object>> r = fmp.get(path, List.class, params);
        return r != null ? r : List.of();
    }

    private FMPSearchResult toSearchResult(Map<String, Object> r) {
        return new FMPSearchResult(
                str(r, "symbol"), str(r, "name"),
                str(r, "exchange"), str(r, "currency")
        );
    }

    private FMPScreenerResult toScreenerResult(Map<String, Object> r) {
        return new FMPScreenerResult(
                str(r, "symbol"), str(r, "companyName"),
                str(r, "sector"), str(r, "exchange"),
                toBD(r.get("marketCap")), toBD(r.get("price")),
                toBD(r.get("beta")), Boolean.TRUE.equals(r.get("isEtf"))
        );
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key); return v != null ? v.toString() : null;
    }
    private BigDecimal toBD(Object val) {
        if (val == null) return null;
        try { return new BigDecimal(val.toString()); } catch (Exception e) { return null; }
    }

    public record FMPSearchResult(String symbol, String name, String exchange, String currency) {}
    public record FMPScreenerResult(String symbol, String name, String sector, String exchange,
                                    BigDecimal marketCap, BigDecimal price, BigDecimal beta, boolean isEtf) {}
    public record FMPPreviewResult(String symbol, String name, String assetType, String exchange,
                                   String currency, String sector, String industry,
                                   BigDecimal marketCap, BigDecimal peRatio, BigDecimal price,
                                   boolean inLibrary) {}
}
