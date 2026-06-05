package com.conviction.portfolio.snapshot.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record PortfolioSnapshotResponse(
        UUID id,
        UUID portfolioId,
        LocalDate snapshotDate,
        BigDecimal totalMarketValue,
        BigDecimal totalCostBasis,
        BigDecimal unrealizedGain,
        BigDecimal realizedGain,
        BigDecimal cashFlow,
        LocalDateTime createdAt
) {
}