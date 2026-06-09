package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Discounted Cash Flow — multi-stage model with perpetuity terminal value.
 *
 * Primary:   IV = Σ(i=1..N) [base×(1+g)^i / (1+d)^i]
 *               + [base×(1+g)^N × (1+gT) / (d−gT)] / (1+d)^N
 *   where gT = terminalGrowthRatePercent (long-run perpetuity rate, e.g. 2.5%)
 *
 * Cross-check (optional): same intermediate CF summation + exit-multiple terminal value
 *   exitMultipleValue = Σ(i=1..N)[base×(1+g)^i/(1+d)^i] + base×(1+g)^N×exitMultiple/(1+d)^N
 *
 * Uses: earningsPerShare, growthRatePercent, discountRatePercent,
 *       years, terminalGrowthRatePercent, exitMultiple (nullable)
 */
@Component
public class DCFStrategy implements ValuationStrategy {

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.DCF;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        return dcfValue(
                request.earningsPerShare(),
                request.growthRatePercent(),
                request.discountRatePercent(),
                request.years(),
                request.terminalGrowthRatePercent()
        );
    }

    @Override
    public BigDecimal calculateExitMultipleValue(ValuationRequest request) {
        if (request.exitMultiple() == null) return null;
        return exitMultipleValue(
                request.earningsPerShare(),
                request.growthRatePercent(),
                request.discountRatePercent(),
                request.years(),
                request.exitMultiple()
        );
    }

    // ── shared static helpers (reused by OwnerEarningsStrategy) ──────────────

    /**
     * Primary DCF intrinsic value using perpetuity terminal value.
     *
     * @param base                     starting cash flow per share (EPS or FCF/share)
     * @param growthPct                annual growth rate, % (e.g. 8 for 8%)
     * @param discountPct              discount rate, % (e.g. 10 for 10%)
     * @param years                    projection horizon
     * @param terminalGrowthRatePct    long-run perpetuity growth rate, % (e.g. 2.5 for 2.5%)
     */
    public static BigDecimal dcfValue(
            BigDecimal base,
            BigDecimal growthPct,
            BigDecimal discountPct,
            int years,
            BigDecimal terminalGrowthRatePct) {

        BigDecimal g  = growthPct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal d  = discountPct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal gT = terminalGrowthRatePct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal denominator = d.subtract(gT);
        if (denominator.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                "Discount rate (" + discountPct + "%) must exceed terminal growth rate (" + terminalGrowthRatePct + "%)");
        }

        BigDecimal onePlusG = BigDecimal.ONE.add(g);
        BigDecimal onePlusD = BigDecimal.ONE.add(d);

        // PV of intermediate cash flows: years 1 to N
        BigDecimal pvCashFlows = BigDecimal.ZERO;
        for (int i = 1; i <= years; i++) {
            BigDecimal cf = base.multiply(onePlusG.pow(i));
            BigDecimal pv = cf.divide(onePlusD.pow(i), 8, RoundingMode.HALF_UP);
            pvCashFlows = pvCashFlows.add(pv);
        }

        // Perpetuity terminal value at year N, discounted to present:
        // TV = finalCF × (1 + gT) / (d − gT)
        BigDecimal finalCF    = base.multiply(onePlusG.pow(years));
        BigDecimal terminalTV = finalCF.multiply(BigDecimal.ONE.add(gT))
                                       .divide(denominator, 8, RoundingMode.HALF_UP);
        BigDecimal pvTerminal = terminalTV.divide(onePlusD.pow(years), 8, RoundingMode.HALF_UP);

        return pvCashFlows.add(pvTerminal).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Exit-multiple cross-check value — includes the same intermediate cash flow summation
     * as dcfValue() so both numbers are apples-to-apples. Only the terminal value formula
     * differs: exit multiple instead of perpetuity.
     */
    public static BigDecimal exitMultipleValue(
            BigDecimal base,
            BigDecimal growthPct,
            BigDecimal discountPct,
            int years,
            BigDecimal exitMultiple) {

        BigDecimal g        = growthPct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal d        = discountPct.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        BigDecimal onePlusG = BigDecimal.ONE.add(g);
        BigDecimal onePlusD = BigDecimal.ONE.add(d);

        // PV of intermediate cash flows — identical to dcfValue()
        BigDecimal pvCashFlows = BigDecimal.ZERO;
        for (int i = 1; i <= years; i++) {
            BigDecimal cf = base.multiply(onePlusG.pow(i));
            BigDecimal pv = cf.divide(onePlusD.pow(i), 8, RoundingMode.HALF_UP);
            pvCashFlows = pvCashFlows.add(pv);
        }

        // Exit-multiple terminal value (differs from perpetuity)
        BigDecimal finalCF    = base.multiply(onePlusG.pow(years));
        BigDecimal terminalTV = finalCF.multiply(exitMultiple);
        BigDecimal pvTerminal = terminalTV.divide(onePlusD.pow(years), 8, RoundingMode.HALF_UP);

        return pvCashFlows.add(pvTerminal).setScale(2, RoundingMode.HALF_UP);
    }
}
