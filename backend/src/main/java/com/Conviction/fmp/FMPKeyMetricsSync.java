package com.conviction.fmp;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.conviction.asset.entity.Asset;
import com.conviction.asset.entity.Equity;
import com.conviction.asset.repository.AssetRepository;

@Service
public class FMPKeyMetricsSync {

    private final FMPClient fmp;
    private final AssetRepository assetRepository;

    public FMPKeyMetricsSync(FMPClient fmp, AssetRepository assetRepository) {
        this.fmp = fmp;
        this.assetRepository = assetRepository;
    }

    @SuppressWarnings("unchecked")
    public FMPKeyMetricsResponse sync(String symbol) {
        List<Map<String, Object>> result = fmp.get("/key-metrics-ttm", List.class, "symbol", symbol);

        BigDecimal peRatioTTM = null;
        BigDecimal revenueGrowth = null;
        if (result != null && !result.isEmpty()) {
            Map<String, Object> m = result.get(0);
            peRatioTTM = toBD(m.get("peRatioTTM"));
            revenueGrowth = toBD(m.get("revenueGrowthTTM"));
        }

        // EPS comes from the income statement TTM endpoint
        BigDecimal epsTTM = null;
        List<Map<String, Object>> incomeResult = fmp.get(
                "/income-statement", List.class,
                "symbol", symbol, "period", "ttm", "limit", "1");
        if (incomeResult != null && !incomeResult.isEmpty()) {
            epsTTM = toBD(incomeResult.get(0).get("epsDiluted"));
        }

        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase()).orElse(null);
        if (asset instanceof Equity eq) {
            if (epsTTM != null) eq.setEps(epsTTM);
            if (peRatioTTM != null) eq.setPeRatio(peRatioTTM);
            assetRepository.save(eq);
        }

        return new FMPKeyMetricsResponse(symbol, epsTTM, peRatioTTM, revenueGrowth);
    }

    private BigDecimal toBD(Object val) {
        if (val == null) return null;
        try { return new BigDecimal(val.toString()); }
        catch (Exception e) { return null; }
    }

    public record FMPKeyMetricsResponse(
            String symbol,
            BigDecimal epsTTM,
            BigDecimal peRatioTTM,
            BigDecimal revenueGrowthTTM
    ) {}
}
