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
@DiscriminatorValue("ETF")
public class ETF extends Asset {

    @Column(precision = 10, scale = 4)
    private BigDecimal expenseRatio;

    private String underlying;

    private String fundFamily;
}
