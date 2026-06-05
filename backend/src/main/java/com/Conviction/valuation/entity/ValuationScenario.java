package com.conviction.valuation.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

    @Column(precision = 19, scale = 4)
    private BigDecimal currentPrice;

    @Column(precision = 19, scale = 4)
    private BigDecimal earningsPerShare;

    @Column(precision = 19, scale = 4)
    private BigDecimal growthRatePercent;

    @Column(precision = 19, scale = 4)
    private BigDecimal discountRatePercent;

    private int years;

    @Column(precision = 19, scale = 4)
    private BigDecimal terminalMultiple;

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