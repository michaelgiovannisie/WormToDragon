package com.conviction.tax.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.conviction.account.entity.Account;
import com.conviction.asset.entity.Asset;
import com.conviction.transaction.entity.Transaction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
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
@Table(name = "tax_lots")
public class TaxLot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buy_transaction_id", nullable = false)
    private Transaction buyTransaction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal quantityPurchased;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal quantityRemaining;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal costBasisPerUnit;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalCostBasis;

    @Column(nullable = false)
    private LocalDate acquisitionDate;

    @Column(nullable = false)
    private Boolean closed = false;

    private LocalDate closedDate;  // date of the sell transaction that fully closed this lot

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}