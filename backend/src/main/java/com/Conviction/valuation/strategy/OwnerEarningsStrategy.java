package com.conviction.valuation.strategy;

import java.math.BigDecimal;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Owner Earnings (FCF-based DCF) — Buffett-style conservative valuation.
 *
 * Uses Free Cash Flow per share as the base instead of reported EPS,
 * which strips out non-cash distortions and reflects actual cash generation.
 * Same corrected multi-stage DCF formula as DCFStrategy.
 *
 *   IV = Σ(i=1..N) [ FCF/share × (1+g)^i / (1+d)^i ]
 *      + [ FCF/share × (1+g)^N × (1+gT) / (d−gT) ] / (1+d)^N
 *   where gT = terminalGrowthRatePercent (long-run perpetuity rate)
 *
 * Uses: freeCashFlowPerShare, growthRatePercent, discountRatePercent,
 *       years, terminalGrowthRatePercent, exitMultiple (nullable)
 */
@Component
public class OwnerEarningsStrategy implements ValuationStrategy {

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.OWNER_EARNINGS;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        BigDecimal fcf = request.freeCashFlowPerShare();
        if (fcf == null || fcf.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                fcf != null && fcf.compareTo(BigDecimal.ZERO) < 0
                    ? "FCF per share is negative — Owner Earnings DCF requires positive cash generation. Consider using the EPS-based DCF model instead."
                    : "freeCashFlowPerShare is required and must be non-zero for the OWNER_EARNINGS model");
        }
        return DCFStrategy.dcfValue(
                fcf,
                request.growthRatePercent(),
                request.discountRatePercent(),
                request.years(),
                request.terminalGrowthRatePercent()
        );
    }

    @Override
    public BigDecimal calculateExitMultipleValue(ValuationRequest request) {
        if (request.exitMultiple() == null || request.freeCashFlowPerShare() == null) return null;
        return DCFStrategy.exitMultipleValue(
                request.freeCashFlowPerShare(),
                request.growthRatePercent(),
                request.discountRatePercent(),
                request.years(),
                request.exitMultiple()
        );
    }
}
