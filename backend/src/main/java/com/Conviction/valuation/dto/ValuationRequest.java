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
        BigDecimal growthRatePercent,
        BigDecimal discountRatePercent,
        int years,
        BigDecimal terminalMultiple
) {
}