package com.conviction.valuation.dto;

import java.math.BigDecimal;

import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.enums.ValuationModelType;

public record ValuationRequest(
        String symbol,
        ValuationModelType modelType,
        ValuationCaseType caseType,
        BigDecimal currentPrice,
        BigDecimal earningsPerShare,
        BigDecimal freeCashFlowPerShare,      // only used by OWNER_EARNINGS; null for all other models
        BigDecimal growthRatePercent,
        BigDecimal discountRatePercent,
        int years,
        BigDecimal terminalGrowthRatePercent, // perpetuity terminal growth rate (e.g. 2.5 for 2.5%)
        BigDecimal exitMultiple,              // nullable — optional P/E exit-multiple cross-check
        BigDecimal bookValuePerShare          // only used by GRAHAM; null for all other models
) {
}