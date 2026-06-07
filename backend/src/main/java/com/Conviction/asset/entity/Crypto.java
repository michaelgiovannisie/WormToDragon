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
@DiscriminatorValue("CRYPTO")
public class Crypto extends Asset {

    private String network;

    private String consensusType;

    @Column(precision = 30, scale = 0)
    private BigDecimal circulatingSupply;

    private Integer marketCapRank;
}
