package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Discounted Cash Flow:
 *   futureEPS = EPS × (1 + g)^n
 *   terminalValue = futureEPS × terminalMultiple
 *   intrinsicValue = terminalValue / (1 + d)^n
 *
 * Uses: earningsPerShare, growthRatePercent, discountRatePercent,
 *       years, terminalMultiple
 */
@Component
public class DCFStrategy implements ValuationStrategy {

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.DCF;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        BigDecimal g = request.growthRatePercent()
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal d = request.discountRatePercent()
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal futureEps = request.earningsPerShare()
                .multiply(BigDecimal.ONE.add(g).pow(request.years()));

        BigDecimal terminalValue = futureEps.multiply(request.terminalMultiple());

        BigDecimal discountFactor = BigDecimal.ONE.add(d).pow(request.years());

        return terminalValue.divide(discountFactor, 2, RoundingMode.HALF_UP);
    }
}
