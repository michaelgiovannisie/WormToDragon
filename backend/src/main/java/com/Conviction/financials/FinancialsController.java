package com.conviction.financials;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.fmp.FMPClient;

@RestController
@RequestMapping("/api/financials")
public class FinancialsController {

    private final FMPClient fmp;
    private final FinancialSnapshotRepository repo;

    public FinancialsController(FMPClient fmp, FinancialSnapshotRepository repo) {
        this.fmp  = fmp;
        this.repo = repo;
    }

    /** Read from DB — fast, no FMP calls. */
    @GetMapping("/{symbol}")
    public FinancialsResponse getFinancials(@PathVariable String symbol) {
        List<FinancialSnapshot> rows = repo.findBySymbolOrderByFiscalYearDesc(symbol.toUpperCase());
        return new FinancialsResponse(symbol.toUpperCase(), rows.stream().map(this::toRow).toList());
    }

    /** Fetch from FMP and persist — called by Sync from FMP button. */
    @PostMapping("/{symbol}/sync")
    public org.springframework.http.ResponseEntity<FinancialsResponse> syncFinancials(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();

        List<Map<String, Object>> income   = fetch("/income-statement",        sym);
        List<Map<String, Object>> balance  = fetch("/balance-sheet-statement", sym);
        List<Map<String, Object>> cashflow = fetch("/cash-flow-statement",     sym);
        List<Map<String, Object>> metrics  = fetch("/key-metrics",             sym);

        if (income.isEmpty()) {
            // FMP returned no income statement data — not a quota issue, just no data for this symbol
            return org.springframework.http.ResponseEntity.ok(
                new FinancialsResponse(sym, List.of())
            );
        }

        for (int i = 0; i < income.size(); i++) {
            Map<String, Object> inc = income.get(i);
            Map<String, Object> bal = i < balance.size()  ? balance.get(i)  : Map.of();
            Map<String, Object> cf  = i < cashflow.size() ? cashflow.get(i) : Map.of();
            Map<String, Object> km  = i < metrics.size()  ? metrics.get(i)  : Map.of();

            String year = str(inc.get("date"));
            if (year == null) continue;

            FinancialSnapshot snap = repo.findBySymbolAndFiscalYear(sym, year)
                    .orElseGet(FinancialSnapshot::new);

            BigDecimal rev = bd(inc.get("revenue"));
            BigDecimal ni  = bd(inc.get("netIncome"));

            snap.setSymbol(sym);
            snap.setFiscalYear(year);
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

            snap.setTotalDebt(debt);
            snap.setCash(bd(bal.get("cashAndCashEquivalents")));
            snap.setDebtToEquity(ratio(debt, equity));
            snap.setCurrentRatio(ratio(ca, cl));
            snap.setRoePct(pct(km.get("returnOnEquity")));
            snap.setRoicPct(pct(km.get("returnOnInvestedCapital")));
            snap.setUpdatedAt(LocalDateTime.now());

            repo.save(snap);
        }

        return org.springframework.http.ResponseEntity.ok(getFinancials(sym));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetch(String path, String symbol) {
        List<Map<String, Object>> result = fmp.get(path, List.class, "symbol", symbol, "limit", "5");
        return result != null ? result : List.of();
    }

    private AnnualRow toRow(FinancialSnapshot s) {
        return new AnnualRow(s.getFiscalYear(), s.getRevenue(), s.getNetIncome(),
                s.getEpsDiluted(), s.getNetMarginPct(), s.getOperatingCashFlow(),
                s.getFreeCashFlow(), s.getTotalDebt(), s.getCash(),
                s.getDebtToEquity(), s.getCurrentRatio(), s.getRoePct(), s.getRoicPct());
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

    public record AnnualRow(
            String date,
            BigDecimal revenue, BigDecimal netIncome, BigDecimal epsDiluted,
            BigDecimal netMarginPct, BigDecimal operatingCashFlow, BigDecimal freeCashFlow,
            BigDecimal totalDebt, BigDecimal cash, BigDecimal debtToEquity,
            BigDecimal currentRatio, BigDecimal roePct, BigDecimal roicPct
    ) {}

    public record FinancialsResponse(String symbol, List<AnnualRow> annual) {}
}
