package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Dividend Discount Model (Gordon Growth Model):
 *   IV = D1 / (r - g)
 *      = D0 × (1 + g) / (r - g)
 *
 *   Where:
 *     D0 = current annual dividend per share
 *     g  = expected dividend growth rate (%)
 *     r  = required rate of return / discount rate (%)
 *
 *   Interpretation: the present value of all future dividends growing
 *   at a constant rate in perpetuity.
 *
 *   Limitations: only meaningful for dividend-paying stocks;
 *   r must exceed g or IV is undefined.
 *
 * Uses: earningsPerShare (as D0 — annual dividend/share),
 *       growthRatePercent, discountRatePercent
 */
@Component
public class DDMStrategy implements ValuationStrategy {

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.DDM;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        if (request.earningsPerShare() == null || request.earningsPerShare().compareTo(BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException("Annual dividend per share is required and must be positive for DDM");
        if (request.growthRatePercent() == null || request.discountRatePercent() == null)
            throw new IllegalArgumentException("Growth rate and discount rate are required for DDM");

        BigDecimal g = request.growthRatePercent().divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal r = request.discountRatePercent().divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal denominator = r.subtract(g);
        if (denominator.compareTo(BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException(
                "Discount rate (" + request.discountRatePercent() + "%) must exceed growth rate (" + request.growthRatePercent() + "%) for DDM");

        // D1 = D0 × (1 + g)
        BigDecimal d1 = request.earningsPerShare().multiply(BigDecimal.ONE.add(g));

        // IV = D1 / (r - g)
        return d1.divide(denominator, 2, RoundingMode.HALF_UP);
    }
}
