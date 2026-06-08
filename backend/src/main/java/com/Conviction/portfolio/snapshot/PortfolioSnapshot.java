package com.conviction.portfolio.snapshot;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.conviction.portfolio.entity.Portfolio;
import com.fasterxml.jackson.annotation.JsonIgnore;

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
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
        name = "portfolio_snapshots",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_portfolio_snapshot_date",
                        columnNames = {
                                "portfolio_id",
                                "snapshot_date"
                        }
                )
        }
)
public class PortfolioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    /**
     * Convenience accessor preserved for existing callers (controller/DTO mapping)
     * that previously read the raw portfolioId column directly.
     */
    public UUID getPortfolioId() {
        return portfolio == null ? null : portfolio.getId();
    }

    @Column(nullable = false)
    private LocalDate snapshotDate;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalMarketValue;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalCostBasis;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal unrealizedGain;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal realizedGain;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal cashFlow;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }

}