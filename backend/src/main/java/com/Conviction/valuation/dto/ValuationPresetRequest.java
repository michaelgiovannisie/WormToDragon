package com.conviction.valuation.dto;

import java.math.BigDecimal;

import com.conviction.valuation.enums.ValuationModelType;

public record ValuationPresetRequest(
        String symbol,
        ValuationModelType modelType,      // which model to run presets for (DCF or OWNER_EARNINGS)
        BigDecimal currentPrice,
        BigDecimal earningsPerShare,
        BigDecimal freeCashFlowPerShare
) {
}