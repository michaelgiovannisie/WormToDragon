package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Benjamin Graham Number:
 *   Graham Number = √(22.5 × EPS × BVPS)
 *
 *   Where:
 *     22.5 = 15 (max P/E) × 1.5 (max P/B) — Graham's dual valuation rule
 *     EPS  = earnings per share (TTM)
 *     BVPS = book value per share
 *
 *   Interpretation: the maximum price a defensive investor should pay.
 *   Works best for asset-heavy companies; unreliable for low/negative book value.
 *
 * Uses: earningsPerShare, bookValuePerShare
 */
@Component
public class GrahamStrategy implements ValuationStrategy {

    private static final BigDecimal GRAHAM_MULTIPLIER = BigDecimal.valueOf(22.5);

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.GRAHAM;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        if (request.earningsPerShare() == null || request.earningsPerShare().compareTo(BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException("EPS is required and must be positive for Graham Number");
        if (request.bookValuePerShare() == null || request.bookValuePerShare().compareTo(BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException("Book Value per Share is required and must be positive for Graham Number");

        // Graham Number = √(22.5 × EPS × BVPS)
        BigDecimal product = GRAHAM_MULTIPLIER
                .multiply(request.earningsPerShare())
                .multiply(request.bookValuePerShare());
        return product.sqrt(MathContext.DECIMAL128).setScale(2, RoundingMode.HALF_UP);
    }
}
