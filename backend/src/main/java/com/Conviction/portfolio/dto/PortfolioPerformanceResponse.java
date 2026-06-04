package com.conviction.portfolio.dto;

import java.math.BigDecimal;

public record PortfolioPerformanceResponse(
        String month,
        BigDecimal portfolioValue
) {
}