package com.conviction.asset.entity;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@DiscriminatorValue("EQUITY")
public class Equity extends Asset {

    private String sector;

    private String industry;

    @Column(precision = 19, scale = 4)
    private BigDecimal marketCap;

    @Column(precision = 19, scale = 4)
    private BigDecimal peRatio;

    @Column(precision = 19, scale = 4)
    private BigDecimal eps;

    @Column(precision = 19, scale = 4)
    private BigDecimal freeCashFlowPerShare;

    /** YoY EPS growth, stored as decimal e.g. 0.08 = 8% */
    @Column(precision = 19, scale = 8)
    private BigDecimal epsGrowth;

    @Column(precision = 19, scale = 4)
    private BigDecimal bookValuePerShare;

    @Column(precision = 19, scale = 4)
    private BigDecimal dividendPerShare;
}
