package com.conviction.dca.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;

/**
 * Buys more when MOS exceeds a threshold, with deployment amount scaling
 * proportionally to how deep the discount is.
 *
 *   MOS >= 30%  → BUY_MORE aggressively  (deploy 100% of available cash)
 *   MOS >= 20%  → BUY_MORE moderately    (deploy 60% of available cash)
 *   MOS >= 10%  → BUY_MORE lightly       (deploy 30% of available cash)
 *   MOS 0–10%   → HOLD
 *   MOS < 0%    → REDUCE (overvalued)
 */
@Component
public class ValueFocusedDCAStrategy implements DCARecommendationStrategy {

    @Override
    public String getName() {
        return "VALUE_FOCUSED";
    }

    @Override
    public DCARecommendation recommend(DCAInput input) {
        if (input.intrinsicValue() == null || input.currentPrice() == null) {
            return noData(input.symbol());
        }

        double mos = input.marginOfSafetyPercent().doubleValue();
        BigDecimal cash = input.availableCash() != null
                ? input.availableCash()
                : BigDecimal.valueOf(1000);

        if (mos >= 30) {
            BigDecimal amount = cash;
            return buy(input, amount, 100,
                    String.format("MOS of %.1f%% is exceptional. Deploying full allocation — strong margin of safety.", mos));
        }
        if (mos >= 20) {
            BigDecimal amount = cash.multiply(BigDecimal.valueOf(0.6)).setScale(2, RoundingMode.HALF_UP);
            return buy(input, amount, 75,
                    String.format("MOS of %.1f%% meets the value threshold. Deploying 60%% of allocation.", mos));
        }
        if (mos >= 10) {
            BigDecimal amount = cash.multiply(BigDecimal.valueOf(0.3)).setScale(2, RoundingMode.HALF_UP);
            return buy(input, amount, 50,
                    String.format("MOS of %.1f%% is positive but thin. Light position add only.", mos));
        }
        if (mos >= 0) {
            return hold(input, String.format("MOS of %.1f%% is insufficient. Wait for a better entry.", mos));
        }

        return reduce(input, String.format(
                "Stock appears overvalued by %.1f%%. Consider trimming or waiting.", Math.abs(mos)));
    }

    private DCARecommendation buy(DCAInput input, BigDecimal amount, int confidence, String rationale) {
        BigDecimal qty = input.currentPrice().compareTo(BigDecimal.ZERO) > 0
                ? amount.divide(input.currentPrice(), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new DCARecommendation(input.symbol(), "BUY_MORE", amount, qty, confidence, rationale, getName());
    }

    private DCARecommendation hold(DCAInput input, String rationale) {
        return new DCARecommendation(input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 40, rationale, getName());
    }

    private DCARecommendation reduce(DCAInput input, String rationale) {
        return new DCARecommendation(input.symbol(), "REDUCE", BigDecimal.ZERO, BigDecimal.ZERO, 30, rationale, getName());
    }

    private DCARecommendation noData(String symbol) {
        return new DCARecommendation(symbol, "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 0,
                "No valuation data available. Run a valuation scenario first.", getName());
    }
}
