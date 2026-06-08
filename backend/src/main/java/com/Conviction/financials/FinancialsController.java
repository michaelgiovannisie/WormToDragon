package com.conviction.financials;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.fmp.FMPClient;

@RestController
@RequestMapping("/api/financials")
public class FinancialsController {

    private final FMPClient fmp;

    public FinancialsController(FMPClient fmp) {
        this.fmp = fmp;
    }

    @SuppressWarnings("unchecked")
    @GetMapping("/{symbol}")
    public FinancialsResponse getFinancials(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();

        List<Map<String, Object>> income  = fetch("/income-statement",        sym);
        List<Map<String, Object>> balance = fetch("/balance-sheet-statement", sym);
        List<Map<String, Object>> cashflow= fetch("/cash-flow-statement",     sym);
        List<Map<String, Object>> metrics = fetch("/key-metrics",             sym);

        List<AnnualRow> rows = new ArrayList<>();
        for (int i = 0; i < income.size(); i++) {
            Map<String, Object> inc = income.get(i);
            Map<String, Object> bal = i < balance.size()  ? balance.get(i)  : Map.of();
            Map<String, Object> cf  = i < cashflow.size() ? cashflow.get(i) : Map.of();
            Map<String, Object> km  = i < metrics.size()  ? metrics.get(i)  : Map.of();

            String date    = str(inc.get("date"));
            BigDecimal rev = bd(inc.get("revenue"));
            BigDecimal ni  = bd(inc.get("netIncome"));
            BigDecimal eps = bd(inc.get("epsDiluted"));

            BigDecimal netMargin = (rev != null && rev.compareTo(BigDecimal.ZERO) != 0 && ni != null)
                    ? ni.divide(rev, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                    : null;

            BigDecimal ocf = bd(cf.get("operatingCashFlow"));
            BigDecimal fcf = bd(cf.get("freeCashFlow"));

            BigDecimal totalDebt   = bd(bal.get("totalDebt"));
            BigDecimal equity      = bd(bal.get("totalStockholdersEquity"));
            BigDecimal currAssets  = bd(bal.get("totalCurrentAssets"));
            BigDecimal currLiab    = bd(bal.get("totalCurrentLiabilities"));
            BigDecimal cash        = bd(bal.get("cashAndCashEquivalents"));

            BigDecimal debtToEquity = (totalDebt != null && equity != null && equity.compareTo(BigDecimal.ZERO) != 0)
                    ? totalDebt.divide(equity, 4, RoundingMode.HALF_UP)
                    : null;

            BigDecimal currentRatio = (currAssets != null && currLiab != null && currLiab.compareTo(BigDecimal.ZERO) != 0)
                    ? currAssets.divide(currLiab, 4, RoundingMode.HALF_UP)
                    : null;

            BigDecimal roe  = pct(km.get("returnOnEquity"));
            BigDecimal roic = pct(km.get("returnOnInvestedCapital"));

            rows.add(new AnnualRow(date, rev, ni, eps, netMargin,
                    ocf, fcf, totalDebt, cash, debtToEquity, currentRatio, roe, roic));
        }

        return new FinancialsResponse(sym, rows);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetch(String path, String symbol) {
        List<Map<String, Object>> result = fmp.get(path, List.class, "symbol", symbol, "limit", "10");
        return result != null ? result : List.of();
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

    private String str(Object val) {
        return val != null ? val.toString() : null;
    }

    public record AnnualRow(
            String date,
            BigDecimal revenue,
            BigDecimal netIncome,
            BigDecimal epsDiluted,
            BigDecimal netMarginPct,
            BigDecimal operatingCashFlow,
            BigDecimal freeCashFlow,
            BigDecimal totalDebt,
            BigDecimal cash,
            BigDecimal debtToEquity,
            BigDecimal currentRatio,
            BigDecimal roePct,
            BigDecimal roicPct
    ) {}

    public record FinancialsResponse(String symbol, List<AnnualRow> annual) {}
}
