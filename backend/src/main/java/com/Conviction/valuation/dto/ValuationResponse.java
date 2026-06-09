package com.conviction.valuation.dto;

import java.math.BigDecimal;

import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.enums.ValuationModelType;

public record ValuationResponse(
        String symbol,
        ValuationModelType modelType,
        ValuationCaseType caseType,
        BigDecimal currentPrice,

        BigDecimal growthRatePercent,
        BigDecimal discountRatePercent,
        int years,
        BigDecimal terminalGrowthRatePercent,  // perpetuity terminal growth rate
        BigDecimal exitMultiple,               // nullable — echoed back if provided
        BigDecimal exitMultipleValue,          // nullable — cross-check intrinsic value via exit multiple

        BigDecimal intrinsicValue,
        BigDecimal marginOfSafetyPercent,
        String valuationLabel
) {
}