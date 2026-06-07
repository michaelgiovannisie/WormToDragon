package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Benjamin Graham Intrinsic Value Formula:
 *   IV = EPS × (8.5 + 2g) × 4.4 / Y
 *
 *   Where:
 *     g = expected annual growth rate (%)
 *     Y = current yield on AAA corporate bonds (%)
 *         — we use discountRatePercent as Y, defaulting to 4.4 if not set
 *     8.5 = P/E for a no-growth company
 *     4.4 = Graham's original AAA bond yield baseline
 *
 * Uses: earningsPerShare, growthRatePercent, discountRatePercent (as bond yield Y)
 */
@Component
public class GrahamStrategy implements ValuationStrategy {

    private static final BigDecimal BASE_PE = BigDecimal.valueOf(8.5);
    private static final BigDecimal GRAHAM_BASELINE_YIELD = BigDecimal.valueOf(4.4);
    private static final BigDecimal GROWTH_MULTIPLIER = BigDecimal.valueOf(2);

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.GRAHAM;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        BigDecimal y = (request.discountRatePercent() != null
                && request.discountRatePercent().compareTo(BigDecimal.ZERO) > 0)
                ? request.discountRatePercent()
                : GRAHAM_BASELINE_YIELD;

        // IV = EPS × (8.5 + 2g) × 4.4 / Y
        BigDecimal fairPE = BASE_PE.add(
                GROWTH_MULTIPLIER.multiply(request.growthRatePercent())
        );

        return request.earningsPerShare()
                .multiply(fairPE)
                .multiply(GRAHAM_BASELINE_YIELD)
                .divide(y, 2, RoundingMode.HALF_UP);
    }
}
