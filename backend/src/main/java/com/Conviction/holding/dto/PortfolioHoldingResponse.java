package com.conviction.holding.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PortfolioHoldingResponse(
        UUID assetId,
        String symbol,
        String assetName,
        BigDecimal quantityHeld,
        BigDecimal totalCostBasis,
        BigDecimal averageCostBasis,
        BigDecimal marketPrice,
        BigDecimal marketValue,
        BigDecimal unrealizedGain,
        BigDecimal allocationPercent,
        LocalDate firstBuyDate,
        BigDecimal dayChange,
        BigDecimal dayChangePct,
        List<BigDecimal> sparkline
) {
}
