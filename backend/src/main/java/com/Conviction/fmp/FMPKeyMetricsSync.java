package com.conviction.fmp;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
        BigDecimal earningsYieldTTM = null;
        if (result != null && !result.isEmpty()) {
            Map<String, Object> m = result.get(0);
            // Stable API exposes earningsYieldTTM (1/PE) rather than peRatioTTM directly.
            // bookValuePerShareTTM is also absent — derived from balance sheet below.
            earningsYieldTTM     = toBD(m.get("earningsYieldTTM"));
            BigDecimal peField   = toBD(m.get("peRatioTTM"));
            if (peField != null) {
                peRatioTTM = peField;
            } else if (earningsYieldTTM != null && earningsYieldTTM.compareTo(BigDecimal.ZERO) != 0) {
                peRatioTTM = BigDecimal.ONE.divide(earningsYieldTTM, 4, RoundingMode.HALF_UP);
            }
            bookValuePerShareTTM = toBD(m.get("bookValuePerShareTTM")); // null on stable API
        }

        // EPS TTM — sum of last 4 quarters of epsDiluted (most reliable across all FMP tiers)
        BigDecimal epsTTM = null;
        BigDecimal sharesOutstanding = null;
        String reportedCurrency = "USD";
        List<Map<String, Object>> quarterlyIncome = fmp.get(
                "/income-statement", List.class,
                "symbol", symbol, "period", "quarter", "limit", "4");
        if (quarterlyIncome != null && !quarterlyIncome.isEmpty()) {
            // Detect currency before summing — FMP returns financials in the company's reporting currency
            Object rc = quarterlyIncome.get(0).get("reportedCurrency");
            if (rc != null && !rc.toString().isBlank()) {
                reportedCurrency = rc.toString().trim().toUpperCase();
            }
            BigDecimal epsSum = BigDecimal.ZERO;
            for (Map<String, Object> q : quarterlyIncome) {
                BigDecimal qEps = toBD(q.get("epsDiluted"));
                if (qEps != null) epsSum = epsSum.add(qEps);
            }
            if (epsSum.compareTo(BigDecimal.ZERO) != 0) epsTTM = epsSum;
            // Use shares from the most recent quarter
            sharesOutstanding = toBD(quarterlyIncome.get(0).get("weightedAverageShsOutDil"));
        }

        // Fetch current quote price — stable API uses query param, not path segment.
        // Price is always in USD for US-listed ADRs.
        BigDecimal quotePrice = null;
        List<Map<String, Object>> quoteResult = fmp.get("/quote", List.class, "symbol", symbol);
        if (quoteResult != null && !quoteResult.isEmpty()) {
            quotePrice = toBD(quoteResult.get(0).get("price"));
        }

        // Currency sanity check using earningsYieldTTM.
        // earningsYieldTTM = netIncome / marketCap — a dimensionless ratio, always correct
        // regardless of reporting currency (NTD/NTD = USD/USD).
        // Therefore: USD EPS = earningsYieldTTM × USD quotePrice.
        //
        // If our income-statement EPS differs from this derived USD EPS by more than 2×,
        // the income statement is in a foreign currency — swap in the corrected value.
        //
        // Example: TSM earningsYieldTTM=0.0313, price=$440.81 → USD EPS=$13.79
        //          income-statement EPS=446 TWD → ratio=32× → mismatch detected → corrected.
        if (epsTTM != null && earningsYieldTTM != null && quotePrice != null
                && earningsYieldTTM.compareTo(BigDecimal.ZERO) != 0
                && quotePrice.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal yieldEps = earningsYieldTTM.multiply(quotePrice).abs().setScale(4, RoundingMode.HALF_UP);
            if (yieldEps.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal ratio = epsTTM.abs().divide(yieldEps, 4, RoundingMode.HALF_UP);
                if (ratio.compareTo(new BigDecimal("2")) > 0
                        || ratio.compareTo(new BigDecimal("0.5")) < 0) {
                    System.out.println("[FMPKeyMetricsSync] Currency mismatch for " + symbol
                            + ": incomeStmtEPS=" + epsTTM
                            + ", yieldDerivedUsdEPS=" + yieldEps
                            + ", ratio=" + ratio.setScale(2, RoundingMode.HALF_UP)
                            + " (reportedCurrency=" + reportedCurrency + ")"
                            + " — correcting to USD EPS");
                    epsTTM = yieldEps;
                }
            }
        }

        // FX rate for other per-share values (FCF, dividend, BVPS).
        // Try FX endpoint; if unavailable just log and leave those fields unconverted
        // (they affect Graham/BVPS models but not the primary DCF).
        BigDecimal fxToUsd = BigDecimal.ONE;
        boolean nonUsd = !"USD".equals(reportedCurrency);
        if (nonUsd) {
            BigDecimal rate = fetchFxToUsd(reportedCurrency);
            if (rate != null) fxToUsd = rate;
            // If rate unavailable we still proceed — EPS was already corrected above.
        }

        // EPS growth — YoY from 2 most recent annual income statements
        // Growth is a ratio (dimensionless) — no FX conversion needed
        BigDecimal epsGrowth = null;
        List<Map<String, Object>> annualIncome = fmp.get(
                "/income-statement", List.class,
                "symbol", symbol, "period", "annual", "limit", "2");
        if (annualIncome != null && annualIncome.size() >= 2) {
            BigDecimal eps0 = toBD(annualIncome.get(0).get("epsDiluted"));
            BigDecimal eps1 = toBD(annualIncome.get(1).get("epsDiluted"));
            if (eps0 != null && eps1 != null && eps1.compareTo(BigDecimal.ZERO) != 0) {
                epsGrowth = eps0.subtract(eps1)
                        .divide(eps1.abs(), 8, RoundingMode.HALF_UP);
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
                fcfPerShareTTM = fcf.divide(shares, 4, RoundingMode.HALF_UP);
                // Convert from local currency to USD
                if (nonUsd && fxToUsd.compareTo(BigDecimal.ONE) != 0) {
                    fcfPerShareTTM = fcfPerShareTTM.multiply(fxToUsd).setScale(4, RoundingMode.HALF_UP);
                }
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
                    dividendPerShareTTM = absDivPaid.divide(shares, 4, RoundingMode.HALF_UP);
                    // Convert from local currency to USD
                    if (nonUsd && fxToUsd.compareTo(BigDecimal.ONE) != 0) {
                        dividendPerShareTTM = dividendPerShareTTM.multiply(fxToUsd).setScale(4, RoundingMode.HALF_UP);
                    }
                }
            }
        }

        // BVPS — prefer key-metrics-ttm field; fall back to computing from balance sheet.
        // key-metrics-ttm returns BVPS in reported currency too, so convert either way.
        if (bookValuePerShareTTM != null && nonUsd && fxToUsd.compareTo(BigDecimal.ONE) != 0) {
            bookValuePerShareTTM = bookValuePerShareTTM.multiply(fxToUsd).setScale(4, RoundingMode.HALF_UP);
        }
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
                    bookValuePerShareTTM = equity.divide(shares, 4, RoundingMode.HALF_UP);
                    // Convert from local currency to USD
                    if (nonUsd && fxToUsd.compareTo(BigDecimal.ONE) != 0) {
                        bookValuePerShareTTM = bookValuePerShareTTM.multiply(fxToUsd).setScale(4, RoundingMode.HALF_UP);
                    }
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

    /** Fetch USD value of 1 unit of fromCurrency (e.g. TWD → 0.031). Returns null on failure. */
    @SuppressWarnings("unchecked")
    private BigDecimal fetchFxToUsd(String fromCurrency) {
        String pair = fromCurrency + "USD";
        // Try FMP forex quotes endpoint first
        try {
            List<Map<String, Object>> r = fmp.get("/fx-quotes/" + pair, List.class);
            if (r != null && !r.isEmpty()) {
                BigDecimal price = toBD(r.get(0).get("price"));
                if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
                    System.out.println("[FMPKeyMetricsSync] FX rate " + pair + " = " + price + " (fx-quotes)");
                    return price;
                }
            }
        } catch (Exception ignored) {}

        // Fallback: try as a regular quote symbol (e.g. TWDUSD)
        try {
            List<Map<String, Object>> r = fmp.get("/quote/" + pair, List.class);
            if (r != null && !r.isEmpty()) {
                BigDecimal price = toBD(r.get(0).get("price"));
                if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
                    System.out.println("[FMPKeyMetricsSync] FX rate " + pair + " = " + price + " (quote)");
                    return price;
                }
            }
        } catch (Exception ignored) {}

        System.err.println("[FMPKeyMetricsSync] FX lookup failed for " + pair);
        return null;
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
