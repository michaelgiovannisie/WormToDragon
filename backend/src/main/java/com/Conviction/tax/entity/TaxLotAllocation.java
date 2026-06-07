package com.conviction.tax.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.conviction.transaction.entity.Transaction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "tax_lot_allocations")
public class TaxLotAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sell_transaction_id", nullable = false)
    private Transaction sellTransaction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tax_lot_id", nullable = false)
    private TaxLot taxLot;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal quantityAllocated;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal proceeds;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal costBasis;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal realizedGain;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}