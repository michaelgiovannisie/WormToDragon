package com.conviction.financials;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/financials")
public class FinancialsController {

    private static final String ANNUAL  = "annual";

    private final FinancialsSyncService syncService;
    private final FinancialSnapshotRepository repo;

    public FinancialsController(FinancialsSyncService syncService, FinancialSnapshotRepository repo) {
        this.syncService = syncService;
        this.repo        = repo;
    }

    /** Read from DB — fast, no FMP calls. Returns both annual and quarterly series. */
    @GetMapping("/{symbol}")
    public FinancialsResponse getFinancials(@PathVariable String symbol) {
        String sym = symbol.toUpperCase();

        List<FinancialSnapshot> annualRows = repo.findBySymbolAndPeriodOrderByFiscalYearDesc(sym, ANNUAL);
        if (annualRows.isEmpty()) {
            annualRows = repo.findBySymbolAndPeriodIsNull(sym);
        }
        List<FinancialSnapshot> quarterRows = repo.findBySymbolAndPeriodOrderByFiscalYearDesc(sym, "quarter");

        return new FinancialsResponse(
            sym,
            annualRows.stream().map(this::toRow).toList(),
            quarterRows.stream().map(this::toRow).toList()
        );
    }

    /** Fetch from FMP (annual + quarterly) and persist. */
    @PostMapping("/{symbol}/sync")
    public org.springframework.http.ResponseEntity<FinancialsResponse> syncFinancials(@PathVariable String symbol) {
        syncService.syncSymbol(symbol.toUpperCase());
        return org.springframework.http.ResponseEntity.ok(getFinancials(symbol));
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
