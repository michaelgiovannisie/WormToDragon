package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Peter Lynch PEG Ratio:
 *   PEG = P/E ÷ EPS growth rate %
 *       = (currentPrice / EPS) / growthRatePercent
 *
 *   Interpretation:
 *     PEG < 1  → potentially undervalued relative to growth
 *     PEG = 1  → fairly valued (Lynch's sweet spot)
 *     PEG > 2  → potentially overvalued relative to growth
 *
 * Uses: currentPrice, earningsPerShare, growthRatePercent
 * Returns: PEG ratio (not a price — stored in intrinsicValue field)
 */
@Component
public class PEGStrategy implements ValuationStrategy {

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.PEG;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        if (request.earningsPerShare() == null || request.earningsPerShare().compareTo(BigDecimal.ZERO) == 0)
            throw new IllegalArgumentException("EPS is required and must be non-zero for PEG ratio");
        if (request.growthRatePercent() == null || request.growthRatePercent().compareTo(BigDecimal.ZERO) == 0)
            throw new IllegalArgumentException("Growth rate is required and must be non-zero for PEG ratio");
        // P/E = currentPrice / EPS
        BigDecimal pe = request.currentPrice()
                .divide(request.earningsPerShare(), 8, RoundingMode.HALF_UP);
        // PEG = P/E / growthRatePercent (e.g. growth of 15 → divide by 15)
        return pe.divide(request.growthRatePercent(), 4, RoundingMode.HALF_UP);
    }
}
