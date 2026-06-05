package com.conviction.marketdata.dto;

import java.math.BigDecimal;

public record UpdateMarketPriceRequest(
        String symbol,
        BigDecimal marketPrice
) {
}