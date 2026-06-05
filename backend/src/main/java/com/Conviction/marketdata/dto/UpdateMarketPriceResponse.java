package com.conviction.marketdata.dto;

import java.math.BigDecimal;

public record UpdateMarketPriceResponse(
        String symbol,
        BigDecimal marketPrice,
        int holdingsUpdated
) {
}