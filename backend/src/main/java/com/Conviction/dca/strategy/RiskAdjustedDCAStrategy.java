package com.conviction.dca.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;

/**
 * Sizes the add relative to the existing position and MOS.
 * Uses a simplified Kelly-inspired formula:
 *
 *   edge   = MOS / 100
 *   add%   = edge × (1 - currentPositionWeight)
 *   amount = availableCash × add%
 *
 * This ensures the recommendation scales down when you already have a large
 * position, even at high MOS — preventing over-concentration.
 *
 * currentPositionWeight = totalCostBasis / (totalCostBasis + availableCash)
 */
@Component
public class RiskAdjustedDCAStrategy implements DCARecommendationStrategy {

    @Override
    public String getName() {
        return "RISK_ADJUSTED";
    }

    @Override
    public DCARecommendation recommend(DCAInput input) {
        if (input.intrinsicValue() == null || input.currentPrice() == null) {
            return noData(input.symbol());
        }

        double mos = input.marginOfSafetyPercent().doubleValue();

        if (mos <= 0) {
            return new DCARecommendation(input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 35,
                    String.format("No margin of safety (MOS %.1f%%). Risk-adjusted model does not recommend adding.", mos),
                    getName());
        }

        BigDecimal cash = input.availableCash() != null ? input.availableCash() : BigDecimal.valueOf(1000);
        BigDecimal costBasis = input.totalCostBasis() != null ? input.totalCostBasis() : BigDecimal.ZERO;

        double totalCapital = costBasis.doubleValue() + cash.doubleValue();
        double positionWeight = totalCapital > 0 ? costBasis.doubleValue() / totalCapital : 0;

        double edge = Math.min(mos / 100.0, 0.5);
        double addFraction = edge * (1.0 - positionWeight);
        addFraction = Math.max(0, Math.min(addFraction, 1.0));

        BigDecimal amount = cash.multiply(BigDecimal.valueOf(addFraction))
                .setScale(2, RoundingMode.HALF_UP);

        if (amount.compareTo(BigDecimal.valueOf(10)) < 0) {
            return new DCARecommendation(input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 45,
                    String.format("Position already well-sized (%.0f%% weight). Risk-adjusted add is negligible.", positionWeight * 100),
                    getName());
        }

        BigDecimal qty = amount.divide(input.currentPrice(), 4, RoundingMode.HALF_UP);
        int confidence = (int) Math.min(90, (mos * 2 + (1 - positionWeight) * 30));

        String rationale = String.format(
                "MOS %.1f%% with current position at %.0f%% of capital. Risk-adjusted add: $%.2f (%.0f%% of available cash).",
                mos, positionWeight * 100, amount.doubleValue(), addFraction * 100);

        return new DCARecommendation(input.symbol(), "BUY_MORE", amount, qty, confidence, rationale, getName());
    }

    private DCARecommendation noData(String symbol) {
        return new DCARecommendation(symbol, "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 0,
                "No valuation data available. Run a valuation scenario first.", getName());
    }
}
