package com.conviction.valuation.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.enums.ValuationModelType;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.conviction.asset.entity.Asset;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "valuation_scenarios")
public class ValuationScenario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String symbol;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id")
    private Asset asset;

    @Enumerated(EnumType.STRING)
    private ValuationModelType modelType;

    @Enumerated(EnumType.STRING)
    private ValuationCaseType caseType;

    @Column(precision = 19, scale = 4)
    private BigDecimal currentPrice;

    @Column(precision = 19, scale = 4)
    private BigDecimal earningsPerShare;

    @Column(precision = 19, scale = 4, nullable = true)
    private BigDecimal freeCashFlowPerShare;

    @Column(precision = 19, scale = 4)
    private BigDecimal growthRatePercent;

    @Column(precision = 19, scale = 4)
    private BigDecimal discountRatePercent;

    private int years;

    @Column(precision = 19, scale = 4, nullable = true)
    private BigDecimal terminalMultiple;          // legacy — kept for backward compat with old scenarios

    @Column(precision = 19, scale = 4, nullable = true)
    private BigDecimal terminalGrowthRatePercent; // perpetuity terminal growth rate for new scenarios

    @Column(precision = 19, scale = 4, nullable = true)
    private BigDecimal exitMultiple;              // optional cross-check multiple

    @Column(precision = 19, scale = 4, nullable = true)
    private BigDecimal exitMultipleValue;         // cross-check intrinsic value

    @Column(precision = 19, scale = 4)
    private BigDecimal intrinsicValue;

    @Column(precision = 19, scale = 4)
    private BigDecimal marginOfSafetyPercent;

    private String valuationLabel;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }

}