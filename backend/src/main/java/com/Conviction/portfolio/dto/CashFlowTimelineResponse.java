package com.conviction.portfolio.dto;

import java.math.BigDecimal;

public record CashFlowTimelineResponse(
        String month,
        BigDecimal cashFlow
) {
}