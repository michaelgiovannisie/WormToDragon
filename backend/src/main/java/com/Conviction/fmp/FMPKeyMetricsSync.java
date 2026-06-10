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
        BigDecimal bookValuePerShareTTM = null;
        if (result != null && !result.isEmpty()) {
            Map<String, Object> m = result.get(0);
            peRatioTTM           = toBD(m.get("peRatioTTM"));
            bookValuePerShareTTM  = toBD(m.get("bookValuePerShareTTM"));
            // Note: dividendPerShareTTM is NOT present in key-metrics-ttm — computed below.
        }

        // EPS TTM — sum of last 4 quarters of epsDiluted (most reliable across all FMP tiers)
        BigDecimal epsTTM = null;
        BigDecimal sharesOutstanding = null;
        List<Map<String, Object>> quarterlyIncome = fmp.get(
                "/income-statement", List.class,
                "symbol", symbol, "period", "quarter", "limit", "4");
        if (quarterlyIncome != null && !quarterlyIncome.isEmpty()) {
            BigDecimal epsSum = BigDecimal.ZERO;
            for (Map<String, Object> q : quarterlyIncome) {
                BigDecimal qEps = toBD(q.get("epsDiluted"));
                if (qEps != null) epsSum = epsSum.add(qEps);
            }
            if (epsSum.compareTo(BigDecimal.ZERO) != 0) epsTTM = epsSum;
            // Use shares from the most recent quarter
            sharesOutstanding = toBD(quarterlyIncome.get(0).get("weightedAverageShsOutDil"));
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

        // Dividend per share — FMP does not expose this in key-metrics-ttm.
        // Compute from most recent annual cash flow: |commonDividendsPaid| / shares.
        BigDecimal dividendPerShareTTM = null;
        List<Map<String, Object>> annualCashFlow = fmp.get(
                "/cash-flow-statement", List.class,
                "symbol", symbol, "period", "annual", "limit", "1");
        if (annualCashFlow != null && !annualCashFlow.isEmpty()) {
            Map<String, Object> acf = annualCashFlow.get(0);
            BigDecimal divPaid = toBD(acf.get("commonDividendsPaid"));
            BigDecimal shares  = sharesOutstanding != null
                    ? sharesOutstanding
                    : toBD(acf.get("weightedAverageShsOutDil"));
            if (divPaid != null && shares != null && shares.compareTo(BigDecimal.ZERO) != 0) {
                // commonDividendsPaid is negative; negate to get the positive amount paid out
                BigDecimal absDivPaid = divPaid.abs();
                if (absDivPaid.compareTo(BigDecimal.ZERO) > 0) {
                    dividendPerShareTTM = absDivPaid.divide(shares, 4, java.math.RoundingMode.HALF_UP);
                }
            }
        }

        // BVPS — prefer key-metrics-ttm field; fall back to computing from balance sheet
        // totalStockholdersEquity / diluted shares outstanding
        if (bookValuePerShareTTM == null) {
            List<Map<String, Object>> balanceSheet = fmp.get(
                    "/balance-sheet-statement", List.class,
                    "symbol", symbol, "period", "annual", "limit", "1");
            if (balanceSheet != null && !balanceSheet.isEmpty()) {
                Map<String, Object> bs = balanceSheet.get(0);
                BigDecimal equity = toBD(bs.get("totalStockholdersEquity"));
                BigDecimal shares = sharesOutstanding != null
                        ? sharesOutstanding
                        : toBD(bs.get("commonStock"));
                if (equity != null && shares != null && shares.compareTo(BigDecimal.ZERO) != 0) {
                    bookValuePerShareTTM = equity.divide(shares, 4, java.math.RoundingMode.HALF_UP);
                }
            }
        }

        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase()).orElse(null);
        if (asset instanceof Equity eq) {
            if (epsTTM               != null) eq.setEps(epsTTM);
            if (peRatioTTM           != null) eq.setPeRatio(peRatioTTM);
            if (fcfPerShareTTM       != null) eq.setFreeCashFlowPerShare(fcfPerShareTTM);
            if (epsGrowth            != null) eq.setEpsGrowth(epsGrowth);
            if (bookValuePerShareTTM != null) eq.setBookValuePerShare(bookValuePerShareTTM);
            if (dividendPerShareTTM  != null) eq.setDividendPerShare(dividendPerShareTTM);
            assetRepository.save(eq);
        }

        return new FMPKeyMetricsResponse(symbol, epsTTM, peRatioTTM, epsGrowth, fcfPerShareTTM, bookValuePerShareTTM, dividendPerShareTTM);
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
            BigDecimal freeCashFlowPerShareTTM,
            BigDecimal bookValuePerShareTTM,
            BigDecimal dividendPerShareTTM
    ) {}
}
