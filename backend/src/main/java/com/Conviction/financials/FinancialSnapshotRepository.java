package com.conviction.financials;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialSnapshotRepository extends JpaRepository<FinancialSnapshot, UUID> {

    List<FinancialSnapshot> findBySymbolOrderByFiscalYearDesc(String symbol);

    Optional<FinancialSnapshot> findBySymbolAndFiscalYear(String symbol, String fiscalYear);

    void deleteBySymbol(String symbol);
}
