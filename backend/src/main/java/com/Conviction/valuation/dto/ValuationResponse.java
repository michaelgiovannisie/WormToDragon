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
        BigDecimal terminalMultiple,

        BigDecimal intrinsicValue,
        BigDecimal marginOfSafetyPercent,
        String valuationLabel
) {
}