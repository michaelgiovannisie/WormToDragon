package com.conviction.financials;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.conviction.fmp.FMPClient;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;

/**
 * Core financials sync logic — extracted from FinancialsController so it can be called
 * directly by the NASDAQ-100 batch job without going through HTTP.
 */
@Service
public class FinancialsSyncService {

    private static final String ANNUAL  = "annual";
    private static final String QUARTER = "quarter";

    private final FMPClient fmp;
    private final FinancialSnapshotRepository repo;
    private final HistoricalPriceRepository priceRepo;

    public FinancialsSyncService(FMPClient fmp,
                                  FinancialSnapshotRepository repo,
                                  HistoricalPriceRepository priceRepo) {
        this.fmp       = fmp;
        this.repo      = repo;
        this.priceRepo = priceRepo;
    }

    /**
     * Fetch financial statements from FMP and persist for the given symbol.
     * Safe: only deletes existing rows for a period when fresh FMP data is available.
     * Returns false if FMP returned nothing (existing data preserved).
     */
    @Transactional
    public boolean syncSymbol(String symbol) {
        String sym = symbol.toUpperCase();

        List<Map<String, Object>> annualIncome   = fetch("/income-statement",        sym, ANNUAL,   10);
        List<Map<String, Object>> annualBalance  = fetch("/balance-sheet-statement", sym, ANNUAL,   10);
        List<Map<String, Object>> annualCashflow = fetch("/cash-flow-statement",     sym, ANNUAL,   10);
        List<Map<String, Object>> annualMetrics  = fetch("/key-metrics",             sym, ANNUAL,   10);
        List<Map<String, Object>> annualRatios   = fetch("/ratios",                  sym, ANNUAL,   10);

        List<Map<String, Object>> qIncome   = fetch("/income-statement",        sym, QUARTER, 12);
        List<Map<String, Object>> qBalance  = fetch("/balance-sheet-statement", sym, QUARTER, 12);
        List<Map<String, Object>> qCashflow = fetch("/cash-flow-statement",     sym, QUARTER, 12);
        List<Map<String, Object>> qMetrics  = fetch("/key-metrics",             sym, QUARTER, 12);
        // Quarterly ratios not available on current FMP plan
        List<Map<String, Object>> qRatios   = List.of();

        if (annualIncome.isEmpty() && qIncome.isEmpty()) {
            return false; // nothing to update
        }

        if (!annualIncome.isEmpty()) {
            repo.deleteBySymbolAndPeriod(sym, ANNUAL);
            persistRows(sym, ANNUAL, annualIncome, annualBalance, annualCashflow, annualMetrics, annualRatios);
        }
        if (!qIncome.isEmpty()) {
            repo.deleteBySymbolAndPeriod(sym, QUARTER);
            persistRows(sym, QUARTER, qIncome, qBalance, qCashflow, qMetrics, qRatios);
        }
        return true;
    }

    // ── private helpers ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetch(String path, String symbol, String period, int limit) {
        List<Map<String, Object>> result = fmp.get(
            path, List.class,
            "symbol", symbol,
            "period", QUARTER.equals(period) ? "quarter" : "annual",
            "limit",  String.valueOf(limit)
        );
        return result != null ? result : List.of();
    }

    private void persistRows(
            String sym, String period,
            List<Map<String, Object>> income,
            List<Map<String, Object>> balance,
            List<Map<String, Object>> cashflow,
            List<Map<String, Object>> metrics,
            List<Map<String, Object>> ratios) {

        // Deduplicate income by date — FMP occasionally returns the same fiscal date
        // twice (e.g. Apple's Sep quarter-end appears as both Q4 and a full-year row).
        // Keep only the first occurrence (newest-first order is preserved).
        java.util.Map<String, Map<String, Object>> seen = new java.util.LinkedHashMap<>();
        for (Map<String, Object> row : income) {
            String d = str(row.get("date"));
            if (d != null) seen.putIfAbsent(d, row);
        }
        income = new java.util.ArrayList<>(seen.values());

        // Pre-compute TTM (trailing twelve months) sums for quarterly metrics.
        // income is ordered newest-first, so TTM for row i = sum of income[i..i+3].
        // Used for: ROE, ROIC (NI), P/E (EPS), P/S (revenue), EV/EBITDA (ebitda).
        int n = income.size();
        BigDecimal[] ttmNi      = new BigDecimal[n];
        BigDecimal[] ttmEps     = new BigDecimal[n];
        BigDecimal[] ttmRev     = new BigDecimal[n];
        BigDecimal[] ttmEbitda  = new BigDecimal[n];
        for (int i = 0; i < n; i++) {
            BigDecimal sumNi  = BigDecimal.ZERO, sumEps = BigDecimal.ZERO;
            BigDecimal sumRev = BigDecimal.ZERO, sumEbt = BigDecimal.ZERO;
            boolean anyNi = false, anyEps = false, anyRev = false, anyEbt = false;
            for (int j = i; j < Math.min(i + 4, n); j++) {
                BigDecimal ni2 = bd(income.get(j).get("netIncome"));
                BigDecimal e   = bd(income.get(j).get("epsDiluted"));
                BigDecimal r   = bd(income.get(j).get("revenue"));
                BigDecimal b   = bd(income.get(j).get("ebitda"));
                if (ni2 != null) { sumNi  = sumNi.add(ni2);  anyNi  = true; }
                if (e   != null) { sumEps = sumEps.add(e);   anyEps = true; }
                if (r   != null) { sumRev = sumRev.add(r);   anyRev = true; }
                if (b   != null) { sumEbt = sumEbt.add(b);   anyEbt = true; }
            }
            ttmNi[i]     = anyNi  ? sumNi  : null;
            ttmEps[i]    = anyEps ? sumEps : null;
            ttmRev[i]    = anyRev ? sumRev : null;
            ttmEbitda[i] = anyEbt ? sumEbt : null;
        }

        for (int i = 0; i < income.size(); i++) {
            Map<String, Object> inc = income.get(i);
            Map<String, Object> bal = i < balance.size()  ? balance.get(i)  : Map.of();
            Map<String, Object> cf  = i < cashflow.size() ? cashflow.get(i) : Map.of();
            Map<String, Object> km  = i < metrics.size()  ? metrics.get(i)  : Map.of();
            Map<String, Object> rt  = i < ratios.size()   ? ratios.get(i)   : Map.of();

            String year = str(inc.get("date"));
            if (year == null) continue;

            FinancialSnapshot snap = repo.findBySymbolAndFiscalYearAndPeriod(sym, year, period)
                    .orElseGet(FinancialSnapshot::new);

            BigDecimal rev = bd(inc.get("revenue"));
            BigDecimal ni  = bd(inc.get("netIncome"));

            snap.setSymbol(sym);
            snap.setFiscalYear(year);
            snap.setPeriod(period);
            snap.setRevenue(rev);
            snap.setNetIncome(ni);
            snap.setEpsDiluted(bd(inc.get("epsDiluted")));
            snap.setNetMarginPct(divide(ni, rev, 100));
            snap.setOperatingCashFlow(bd(cf.get("operatingCashFlow")));
            snap.setFreeCashFlow(bd(cf.get("freeCashFlow")));

            BigDecimal debt   = bd(bal.get("totalDebt"));
            BigDecimal equity = bd(bal.get("totalStockholdersEquity"));
            BigDecimal ca     = bd(bal.get("totalCurrentAssets"));
            BigDecimal cl     = bd(bal.get("totalCurrentLiabilities"));
            BigDecimal cash   = bd(bal.get("cashAndCashEquivalents"));
            BigDecimal ebitda = bd(inc.get("ebitda"));
            Long shares = inc.get("weightedAverageShsOutDil") != null
                    ? Long.valueOf(inc.get("weightedAverageShsOutDil").toString().split("\\.")[0]) : null;

            snap.setTotalDebt(debt);
            snap.setCash(cash);
            snap.setEbitda(ebitda);
            snap.setSharesOutstanding(shares);
            snap.setTotalStockholdersEquity(equity);
            snap.setDebtToEquity(ratio(debt, equity));
            snap.setCurrentRatio(ratio(ca, cl));

            // Prefer key-metrics values; fall back to manual calculation from statements.
            // For quarterly: FMP key-metrics?period=quarter is unavailable on this plan,
            // so km will be empty — use TTM net income to avoid understating by ~4×.
            BigDecimal kmRoe  = pct(km.get("returnOnEquity"));
            BigDecimal kmRoic = pct(km.get("returnOnInvestedCapital"));
            BigDecimal niForRatios = QUARTER.equals(period) ? ttmNi[i] : ni;

            // ROE  = TTM net income / equity × 100
            snap.setRoePct(kmRoe  != null ? kmRoe  : divide(niForRatios, equity, 100));

            // ROIC = TTM net income / (equity + debt - cash) × 100
            BigDecimal investedCapital = (equity != null && debt != null && cash != null)
                    ? equity.add(debt).subtract(cash) : null;
            snap.setRoicPct(kmRoic != null ? kmRoic : divide(niForRatios, investedCapital, 100));

            // Valuation multiples ─────────────────────────────────────────────
            // Annual:    use /ratios directly (most accurate)
            // Quarterly: compute from price on fiscal date + TTM statements
            if (!rt.isEmpty()) {
                snap.setPeRatio(bd(rt.get("priceToEarningsRatio")));
                snap.setPbRatio(bd(rt.get("priceToBookRatio")));
                snap.setPsRatio(bd(rt.get("priceToSalesRatio")));
                snap.setEvToEbitda(bd(rt.get("enterpriseValueMultiple")));
            } else if (year != null && shares != null) {
                try {
                    java.time.LocalDate fiscalDate = java.time.LocalDate.parse(year);
                    BigDecimal price = priceRepo
                            .findTopByAssetSymbolAndPriceDateLessThanEqualOrderByPriceDateDesc(sym, fiscalDate)
                            .map(p -> p.getClose())
                            .orElse(null);
                    if (price != null) {
                        BigDecimal sharesB   = BigDecimal.valueOf(shares);
                        BigDecimal marketCap = price.multiply(sharesB);
                        BigDecimal ttmE = ttmEps[i];
                        BigDecimal ttmR = ttmRev[i];
                        BigDecimal ttmB = ttmEbitda[i];

                        // Only use TTM-based multiples when we have a full 4-quarter window.
                        // For the oldest 1–3 rows the TTM sum is incomplete (< 4 quarters),
                        // which inflates P/E dramatically — better to show null than a misleading number.
                        boolean fullTtm = QUARTER.equals(period) ? (i + 4 <= n) : true;

                        snap.setPeRatio(fullTtm && ttmE != null && ttmE.compareTo(BigDecimal.ZERO) != 0
                                ? price.divide(ttmE, 2, RoundingMode.HALF_UP) : null);
                        snap.setPsRatio(fullTtm && ttmR != null && ttmR.compareTo(BigDecimal.ZERO) != 0
                                ? marketCap.divide(ttmR, 2, RoundingMode.HALF_UP) : null);
                        snap.setPbRatio(equity != null && equity.compareTo(BigDecimal.ZERO) != 0
                                ? marketCap.divide(equity, 2, RoundingMode.HALF_UP) : null);
                        if (fullTtm && ttmB != null && debt != null && cash != null && ttmB.compareTo(BigDecimal.ZERO) != 0) {
                            BigDecimal ev = marketCap.add(debt).subtract(cash);
                            snap.setEvToEbitda(ev.divide(ttmB, 2, RoundingMode.HALF_UP));
                        }
                    }
                } catch (Exception ignored) { /* date parse or price lookup failed */ }
            }

            snap.setUpdatedAt(LocalDateTime.now());
            repo.save(snap);
        }
    }

    private BigDecimal bd(Object val) {
        if (val == null) return null;
        try { return new BigDecimal(val.toString()); }
        catch (Exception e) { return null; }
    }

    private BigDecimal pct(Object val) {
        BigDecimal v = bd(val);
        return v != null ? v.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP) : null;
    }

    private BigDecimal ratio(BigDecimal num, BigDecimal den) {
        if (num == null || den == null || den.compareTo(BigDecimal.ZERO) == 0) return null;
        return num.divide(den, 4, RoundingMode.HALF_UP);
    }

    private BigDecimal divide(BigDecimal num, BigDecimal den, int multiplier) {
        if (num == null || den == null || den.compareTo(BigDecimal.ZERO) == 0) return null;
        return num.divide(den, 4, RoundingMode.HALF_UP)
                  .multiply(BigDecimal.valueOf(multiplier));
    }

    private String str(Object val) { return val != null ? val.toString() : null; }
}
