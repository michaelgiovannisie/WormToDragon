package com.conviction.valuation.dto;

import java.math.BigDecimal;

public record ValuationPresetRequest(
        String symbol,
        BigDecimal currentPrice,
        BigDecimal earningsPerShare
) {
}