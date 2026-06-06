package com.conviction.valuation.dto;

import java.math.BigDecimal;

import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.enums.ValuationModelType;

public record ValuationResponse(
        String symbol,
        ValuationModelType modelType,
        ValuationCaseType caseType,
        BigDecimal currentPrice,
        BigDecimal intrinsicValue,
        BigDecimal marginOfSafetyPercent,
        String valuationLabel
) {
}