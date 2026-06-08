package com.conviction.financials;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FinancialSnapshotRepository extends JpaRepository<FinancialSnapshot, UUID> {

    /** All rows for a symbol ordered newest first (used for legacy null-period rows). */
    List<FinancialSnapshot> findBySymbolOrderByFiscalYearDesc(String symbol);

    /** Rows filtered by period, ordered newest first. */
    List<FinancialSnapshot> findBySymbolAndPeriodOrderByFiscalYearDesc(String symbol, String period);

    /** Rows where period is null (backwards-compat rows from before this migration). */
    @Query("SELECT s FROM FinancialSnapshot s WHERE s.symbol = :symbol AND s.period IS NULL ORDER BY s.fiscalYear DESC")
    List<FinancialSnapshot> findBySymbolAndPeriodIsNull(@Param("symbol") String symbol);

    /** Lookup by symbol + fiscalYear + period for upsert. */
    Optional<FinancialSnapshot> findBySymbolAndFiscalYearAndPeriod(String symbol, String fiscalYear, String period);

    void deleteBySymbol(String symbol);

    void deleteBySymbolAndPeriod(String symbol, String period);
}
