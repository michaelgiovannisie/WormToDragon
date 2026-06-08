package com.conviction.financials;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.fmp.FMPClient;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;

@RestController
@RequestMapping("/api/financials")
public class FinancialsController {

    private static final String ANNUAL  = "annual";
    private static final String QUARTER = "quarter";

    private final FMPClient fmp;
    private final FinancialSnapshotRepository repo;
    private final HistoricalPriceRepository priceRepo;

    public FinancialsController(FMPClient fmp, FinancialSnapshotRepository repo, HistoricalPriceRepository priceRepo) {
        this.fmp       = fmp;
        this.repo      = repo;
        this.priceRepo = priceRepo;
    }

    /** Read from DB — fast, no FMP calls. Returns both annual and quarterly series. */
    @GetMapping("/{symbol}")
    public FinancialsResponse getFinancials(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();

        // Include legacy null-period rows as annual for backwards compatibility
        List<FinancialSnapshot> annualRows = repo.findBySymbolAndPeriodOrderByFiscalYearDesc(sym, ANNUAL);
        if (annualRows.isEmpty()) {
            annualRows = repo.findBySymbolAndPeriodIsNull(sym);
        }

        List<FinancialSnapshot> quarterRows = repo.findBySymbolAndPeriodOrderByFiscalYearDesc(sym, QUARTER);

        return new FinancialsResponse(
            sym,
            annualRows.stream().map(this::toRow).toList(),
            quarterRows.stream().map(this::toRow).toList()
        );
    }

    /** Fetch from FMP (annual + quarterly) and persist. */
    @PostMapping("/{symbol}/sync")
    @Transactional
    public org.springframework.http.ResponseEntity<FinancialsResponse> syncFinancials(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();

        // Annual (FMP default, limit=10)
        List<Map<String, Object>> annualIncome   = fetch("/income-statement",        sym, "annual",  10);
        List<Map<String, Object>> annualBalance  = fetch("/balance-sheet-statement", sym, "annual",  10);
        List<Map<String, Object>> annualCashflow = fetch("/cash-flow-statement",     sym, "annual",  10);
        List<Map<String, Object>> annualMetrics  = fetch("/key-metrics",             sym, "annual",  10);
        List<Map<String, Object>> annualRatios   = fetch("/ratios",                  sym, "annual",  10);

        // Quarterly (last 12 quarters ≈ 3 years)
        List<Map<String, Object>> qIncome   = fetch("/income-statement",        sym, "quarter", 12);
        List<Map<String, Object>> qBalance  = fetch("/balance-sheet-statement", sym, "quarter", 12);
        List<Map<String, Object>> qCashflow = fetch("/cash-flow-statement",     sym, "quarter", 12);
        List<Map<String, Object>> qMetrics  = fetch("/key-metrics",             sym, "quarter", 12);
        // Quarterly ratios not available on current FMP plan — omit gracefully
        List<Map<String, Object>> qRatios   = List.of();

        if (annualIncome.isEmpty() && qIncome.isEmpty()) {
            // FMP returned nothing — preserve existing data, don't wipe it
            return org.springframework.http.ResponseEntity.ok(getFinancials(sym));
        }

        // Only delete what we're about to replace — so a partial FMP failure
        // doesn't destroy data we're not refreshing
        if (!annualIncome.isEmpty()) {
            repo.deleteBySymbolAndPeriod(sym, ANNUAL);
            persistRows(sym, ANNUAL, annualIncome, annualBalance, annualCashflow, annualMetrics, annualRatios);
        }
        if (!qIncome.isEmpty()) {
            repo.deleteBySymbolAndPeriod(sym, QUARTER);
            persistRows(sym, QUARTER, qIncome, qBalance, qCashflow, qMetrics, qRatios);
        }

        return org.springframework.http.ResponseEntity.ok(getFinancials(sym));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void persistRows(
            String sym, String period,
            List<Map<String, Object>> income,
            List<Map<String, Object>> balance,
            List<Map<String, Object>> cashflow,
            List<Map<String, Object>> metrics,
            List<Map<String, Object>> ratios) {

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
            // TTM NI for quarterly fallback; annual: use reported NI (FMP key-metrics handles it)
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
                // Look up closing price on or just before the fiscal date
                try {
                    java.time.LocalDate fiscalDate = java.time.LocalDate.parse(year);
                    BigDecimal price = priceRepo
                            .findTopByAssetSymbolAndPriceDateLessThanEqualOrderByPriceDateDesc(sym, fiscalDate)
                            .map(p -> p.getClose())
                            .orElse(null);
                    if (price != null) {
                        BigDecimal sharesB   = BigDecimal.valueOf(shares);
                        BigDecimal marketCap = price.multiply(sharesB);

                        // TTM (trailing twelve months) = sum of this + 3 prior quarters
                        BigDecimal ttmE = ttmEps[i];
                        BigDecimal ttmR = ttmRev[i];
                        BigDecimal ttmB = ttmEbitda[i];

                        // P/E = price / TTM EPS
                        snap.setPeRatio(ttmE != null && ttmE.compareTo(BigDecimal.ZERO) != 0
                                ? price.divide(ttmE, 2, java.math.RoundingMode.HALF_UP) : null);
                        // P/S = market cap / TTM revenue
                        snap.setPsRatio(ttmR != null && ttmR.compareTo(BigDecimal.ZERO) != 0
                                ? marketCap.divide(ttmR, 2, java.math.RoundingMode.HALF_UP) : null);
                        // P/B = market cap / equity (balance-sheet point-in-time — no TTM)
                        snap.setPbRatio(equity != null && equity.compareTo(BigDecimal.ZERO) != 0
                                ? marketCap.divide(equity, 2, java.math.RoundingMode.HALF_UP) : null);
                        // EV/EBITDA = (market cap + debt - cash) / TTM EBITDA
                        if (ttmB != null && debt != null && cash != null && ttmB.compareTo(BigDecimal.ZERO) != 0) {
                            BigDecimal ev = marketCap.add(debt).subtract(cash);
                            snap.setEvToEbitda(ev.divide(ttmB, 2, java.math.RoundingMode.HALF_UP));
                        }
                    }
                } catch (Exception ignored) { /* date parse or price lookup failed — leave null */ }
            }

            snap.setUpdatedAt(LocalDateTime.now());

            repo.save(snap);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetch(String path, String symbol, String period, int limit) {
        List<Map<String, Object>> result = fmp.get(
            path, List.class,
            "symbol", symbol,
            "period", period.equals(QUARTER) ? "quarter" : "annual",
            "limit",  String.valueOf(limit)
        );
        return result != null ? result : List.of();
    }

    private AnnualRow toRow(FinancialSnapshot s) {
        return new AnnualRow(
            s.getFiscalYear(), s.getPeriod(),
            s.getRevenue(), s.getNetIncome(),
            s.getEpsDiluted(), s.getNetMarginPct(),
            s.getOperatingCashFlow(), s.getFreeCashFlow(),
            s.getTotalDebt(), s.getCash(),
            s.getDebtToEquity(), s.getCurrentRatio(),
            s.getRoePct(), s.getRoicPct(),
            s.getPeRatio(), s.getPbRatio(), s.getPsRatio(), s.getEvToEbitda()
        );
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

    // ── response records ─────────────────────────────────────────────────────

    public record AnnualRow(
            String date,
            String period,
            BigDecimal revenue, BigDecimal netIncome, BigDecimal epsDiluted,
            BigDecimal netMarginPct, BigDecimal operatingCashFlow, BigDecimal freeCashFlow,
            BigDecimal totalDebt, BigDecimal cash, BigDecimal debtToEquity,
            BigDecimal currentRatio, BigDecimal roePct, BigDecimal roicPct,
            BigDecimal peRatio, BigDecimal pbRatio, BigDecimal psRatio, BigDecimal evToEbitda
    ) {}

    public record FinancialsResponse(String symbol, List<AnnualRow> annual, List<AnnualRow> quarterly) {}
}
