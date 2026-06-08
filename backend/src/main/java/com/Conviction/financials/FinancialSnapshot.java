package com.conviction.financials;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "financial_snapshots",
       uniqueConstraints = @UniqueConstraint(columnNames = {"symbol", "fiscal_year"}))
public class FinancialSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String symbol;

    @Column(name = "fiscal_year")
    private String fiscalYear;

    private BigDecimal revenue;
    private BigDecimal netIncome;
    private BigDecimal epsDiluted;
    private BigDecimal netMarginPct;
    private BigDecimal operatingCashFlow;
    private BigDecimal freeCashFlow;
    private BigDecimal totalDebt;
    private BigDecimal cash;
    private BigDecimal debtToEquity;
    private BigDecimal currentRatio;
    private BigDecimal roePct;
    private BigDecimal roicPct;

    private LocalDateTime updatedAt;
}
