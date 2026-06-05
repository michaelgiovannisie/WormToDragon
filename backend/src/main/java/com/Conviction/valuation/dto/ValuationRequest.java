package com.conviction.valuation.dto;

import java.math.BigDecimal;

public record ValuationRequest(
        String symbol,
        BigDecimal currentPrice,
        BigDecimal earningsPerShare,
        BigDecimal growthRatePercent,
        BigDecimal discountRatePercent,
        int years,
        BigDecimal terminalMultiple
) {
}