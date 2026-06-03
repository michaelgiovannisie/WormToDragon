package com.conviction.holding.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record HoldingResponse(
        UUID id,
        UUID accountId,
        UUID assetId,
        String symbol,
        String assetName,
        BigDecimal quantityHeld,
        BigDecimal totalCostBasis,
        BigDecimal averageCostBasis,
        BigDecimal marketPrice,
        BigDecimal marketValue,
        BigDecimal unrealizedGain,
        Boolean active,
        LocalDateTime lastCalculatedAt
) {
}