package com.conviction.dca.dto;

import java.math.BigDecimal;

public record DCARecommendation(
        String symbol,
        String action,                  // BUY_MORE | HOLD | REDUCE
        BigDecimal suggestedAmount,     // dollars to deploy
        BigDecimal suggestedQuantity,   // shares to buy
        int confidenceScore,            // 0–100
        String rationale,
        String strategyUsed
) {}
