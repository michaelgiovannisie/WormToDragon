package com.conviction.valuation.dto;

import java.math.BigDecimal;

public record ValuationResponse(
        String symbol,
        BigDecimal currentPrice,
        BigDecimal intrinsicValue,
        BigDecimal marginOfSafetyPercent,
        String valuationLabel
) {
}