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
        if (result != null && !result.isEmpty()) {
            Map<String, Object> m = result.get(0);
            peRatioTTM = toBD(m.get("peRatioTTM"));
        }

        // EPS TTM — from income statement
        BigDecimal epsTTM = null;
        BigDecimal sharesOutstanding = null;
        List<Map<String, Object>> incomeResult = fmp.get(
                "/income-statement", List.class,
                "symbol", symbol, "period", "ttm", "limit", "1");
        if (incomeResult != null && !incomeResult.isEmpty()) {
            Map<String, Object> inc = incomeResult.get(0);
            epsTTM           = toBD(inc.get("epsDiluted"));
            sharesOutstanding = toBD(inc.get("weightedAverageShsOutDil"));
        }

        // EPS growth — YoY from 2 most recent annual income statements
        BigDecimal epsGrowth = null;
        List<Map<String, Object>> annualIncome = fmp.get(
                "/income-statement", List.class,
                "symbol", symbol, "period", "annual", "limit", "2");
        if (annualIncome != null && annualIncome.size() >= 2) {
            BigDecimal eps0 = toBD(annualIncome.get(0).get("epsDiluted"));
            BigDecimal eps1 = toBD(annualIncome.get(1).get("epsDiluted"));
            if (eps0 != null && eps1 != null && eps1.compareTo(BigDecimal.ZERO) != 0) {
                epsGrowth = eps0.subtract(eps1)
                        .divide(eps1.abs(), 8, java.math.RoundingMode.HALF_UP);
            }
        }

        // FCF per share — computed from TTM cash flow statement + diluted shares
        BigDecimal fcfPerShareTTM = null;
        List<Map<String, Object>> cashFlow = fmp.get(
                "/cash-flow-statement", List.class,
                "symbol", symbol, "period", "ttm", "limit", "1");
        if (cashFlow != null && !cashFlow.isEmpty()) {
            Map<String, Object> cf = cashFlow.get(0);
            BigDecimal fcf    = toBD(cf.get("freeCashFlow"));
            BigDecimal shares = sharesOutstanding != null
                    ? sharesOutstanding
                    : toBD(cf.get("weightedAverageShsOutDil"));
            if (fcf != null && shares != null && shares.compareTo(BigDecimal.ZERO) != 0) {
                fcfPerShareTTM = fcf.divide(shares, 4, java.math.RoundingMode.HALF_UP);
            }
        }

        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase()).orElse(null);
        if (asset instanceof Equity eq) {
            if (epsTTM        != null) eq.setEps(epsTTM);
            if (peRatioTTM    != null) eq.setPeRatio(peRatioTTM);
            if (fcfPerShareTTM != null) eq.setFreeCashFlowPerShare(fcfPerShareTTM);
            if (epsGrowth     != null) eq.setEpsGrowth(epsGrowth);
            assetRepository.save(eq);
        }

        return new FMPKeyMetricsResponse(symbol, epsTTM, peRatioTTM, epsGrowth, fcfPerShareTTM);
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
            BigDecimal epsGrowth,
            BigDecimal freeCashFlowPerShareTTM
    ) {}
}
