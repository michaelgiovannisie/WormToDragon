package com.conviction.dca.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;

/**
 * High-conviction lump-sum strategy for growth investors.
 * Only triggers at significant dislocations (MOS >= 25%).
 * When it triggers, it recommends deploying the full cash allocation at once
 * rather than spreading it over time — maximizing upside on deep dips.
 *
 *   MOS >= 40%  → Full lump sum, confidence 95
 *   MOS >= 25%  → Full lump sum, confidence 75
 *   MOS < 25%   → HOLD — not a meaningful dip for this strategy
 */
@Component
public class AggressiveGrowthDCAStrategy implements DCARecommendationStrategy {

    @Override
    public String getName() {
        return "AGGRESSIVE_GROWTH";
    }

    @Override
    public DCARecommendation recommend(DCAInput input) {
        if (input.intrinsicValue() == null || input.currentPrice() == null) {
            return noData(input.symbol());
        }

        double mos = input.marginOfSafetyPercent().doubleValue();
        BigDecimal cash = input.availableCash() != null ? input.availableCash() : BigDecimal.valueOf(1000);

        if (mos >= 40) {
            BigDecimal qty = cash.divide(input.currentPrice(), 4, RoundingMode.HALF_UP);
            return new DCARecommendation(input.symbol(), "BUY_MORE", cash, qty, 95,
                    String.format("MOS of %.1f%% is a rare dislocation. Deploy full allocation now — high-conviction lump sum.", mos),
                    getName());
        }

        if (mos >= 25) {
            BigDecimal qty = cash.divide(input.currentPrice(), 4, RoundingMode.HALF_UP);
            return new DCARecommendation(input.symbol(), "BUY_MORE", cash, qty, 75,
                    String.format("MOS of %.1f%% exceeds aggressive threshold. Deploy full cash allocation.", mos),
                    getName());
        }

        if (mos >= 0) {
            return new DCARecommendation(input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 30,
                    String.format("MOS of %.1f%% is below the 25%% aggressive entry threshold. Wait for a deeper dip.", mos),
                    getName());
        }

        return new DCARecommendation(input.symbol(), "REDUCE", BigDecimal.ZERO, BigDecimal.ZERO, 20,
                String.format("Stock is overvalued by %.1f%%. Consider harvesting gains.", Math.abs(mos)),
                getName());
    }

    private DCARecommendation noData(String symbol) {
        return new DCARecommendation(symbol, "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 0,
                "No valuation data available. Run a valuation scenario first.", getName());
    }
}
