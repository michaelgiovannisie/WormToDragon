package com.conviction.dca.dto;

import java.math.BigDecimal;

public record DCAInput(
        String symbol,
        BigDecimal currentPrice,
        BigDecimal intrinsicValue,
        BigDecimal marginOfSafetyPercent,
        BigDecimal quantityHeld,
        BigDecimal totalCostBasis,
        BigDecimal averageCostBasis,
        BigDecimal availableCash       // optional — caller provides budget
) {}
