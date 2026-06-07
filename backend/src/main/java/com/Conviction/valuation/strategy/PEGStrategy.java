package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Peter Lynch PEG Ratio:
 *   A stock is fairly valued when PEG = 1, meaning P/E = growth rate.
 *   Fair P/E = growthRatePercent  (e.g. 15% growth → fair P/E of 15)
 *   Intrinsic value = EPS × growthRatePercent
 *
 * Uses: earningsPerShare, growthRatePercent
 */
@Component
public class PEGStrategy implements ValuationStrategy {

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.PEG;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        return request.earningsPerShare()
                .multiply(request.growthRatePercent())
                .setScale(2, RoundingMode.HALF_UP);
    }
}
