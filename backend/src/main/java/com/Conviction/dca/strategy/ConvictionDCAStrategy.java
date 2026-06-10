package com.conviction.dca.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;

/**
 * Unified DCA strategy combining two concerns:
 *
 *  1. SIGNAL  (VALUE_FOCUSED logic)
 *     Should I buy at all? Determined by margin of safety:
 *       MOS >= 30% → strong buy   (base confidence 90)
 *       MOS >= 20% → moderate buy (base confidence 70)
 *       MOS >= 10% → light buy    (base confidence 50)
 *       MOS  0–10% → hold
 *       MOS < 0%   → reduce (overvalued)
 *
 *  2. SIZING  (RISK_ADJUSTED / Kelly-inspired logic)
 *     How much to deploy? Scales with edge (MOS) and available room
 *     before over-concentrating:
 *       edge           = min(MOS / 100, 0.5)
 *       positionWeight = totalCostBasis / (totalCostBasis + availableCash)
 *       deployFraction = edge × (1 − positionWeight)
 *
 *  Confidence score is dynamic, not hardcoded:
 *       confidence = baseConfidence + positionRoomBonus − concentrationPenalty
 *     where:
 *       positionRoomBonus    = (1 − positionWeight) × 15   (up to +15 when lightly positioned)
 *       concentrationPenalty = positionWeight × 20          (up to −20 when already heavy)
 *     Clamped to [10, 95].
 */
@Component
public class ConvictionDCAStrategy {

    public DCARecommendation recommend(DCAInput input) {
        if (input.intrinsicValue() == null || input.currentPrice() == null) {
            return new DCARecommendation(
                input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, 0,
                "No valuation data available. Run a valuation scenario first.",
                "CONVICTION"
            );
        }

        double mos  = input.marginOfSafetyPercent() != null ? input.marginOfSafetyPercent().doubleValue() : 0;
        BigDecimal cash = input.availableCash() != null ? input.availableCash() : BigDecimal.valueOf(1000);
        BigDecimal costBasis = input.totalCostBasis() != null ? input.totalCostBasis() : BigDecimal.ZERO;

        // ── Overvalued ───────────────────────────────────────────────────────────
        if (mos < 0) {
            double penalty = Math.abs(mos);
            int confidence = clamp((int) (30 - penalty), 5, 35);
            return new DCARecommendation(
                input.symbol(), "REDUCE", BigDecimal.ZERO, BigDecimal.ZERO, confidence,
                String.format("Stock trades %.1f%% above intrinsic value. No margin of safety — consider trimming or waiting for a better entry.", penalty),
                "CONVICTION"
            );
        }

        // ── Insufficient MOS → hold ───────────────────────────────────────────
        if (mos < 10) {
            int confidence = clamp((int) (35 + mos * 0.5), 35, 45);
            return new DCARecommendation(
                input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, confidence,
                String.format("MOS of %.1f%% is too thin to justify adding. Wait for a wider discount.", mos),
                "CONVICTION"
            );
        }

        // ── Buy signal — determine base confidence from MOS tier ─────────────
        int baseConfidence;
        String signalNote;
        if (mos >= 30) {
            baseConfidence = 90;
            signalNote = String.format("MOS of %.1f%% is exceptional — strong value entry.", mos);
        } else if (mos >= 20) {
            baseConfidence = 70;
            signalNote = String.format("MOS of %.1f%% clears the value threshold.", mos);
        } else {
            baseConfidence = 50;
            signalNote = String.format("MOS of %.1f%% is positive but thin — light add only.", mos);
        }

        // ── Position sizing (Kelly-inspired) ─────────────────────────────────
        double totalCapital   = costBasis.doubleValue() + cash.doubleValue();
        double positionWeight = totalCapital > 0 ? costBasis.doubleValue() / totalCapital : 0;
        double edge           = Math.min(mos / 100.0, 0.5);
        double deployFraction = edge * (1.0 - positionWeight);
        deployFraction = Math.max(0, Math.min(deployFraction, 1.0));

        BigDecimal amount = cash.multiply(BigDecimal.valueOf(deployFraction))
                .setScale(2, RoundingMode.HALF_UP);

        // If the position is already very large, sizing may round to near zero
        if (amount.compareTo(BigDecimal.valueOf(10)) < 0) {
            int conf = clamp((int)(baseConfidence * 0.6), 20, 55);
            return new DCARecommendation(
                input.symbol(), "HOLD", BigDecimal.ZERO, BigDecimal.ZERO, conf,
                String.format("%s However, position is already %.0f%% of available capital — risk-adjusted sizing suggests no additional add at this time.",
                    signalNote, positionWeight * 100),
                "CONVICTION"
            );
        }

        // ── Confidence: base + room bonus − concentration penalty ────────────
        double roomBonus          = (1.0 - positionWeight) * 15;
        double concentrationPenalty = positionWeight * 20;
        int confidence = clamp((int)(baseConfidence + roomBonus - concentrationPenalty), 10, 95);

        BigDecimal qty = input.currentPrice().compareTo(BigDecimal.ZERO) > 0
                ? amount.divide(input.currentPrice(), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        String rationale = String.format(
            "%s Position is %.0f%% of available capital — deploying %.0f%% of cash ($%.2f, ≈ %.4f shares).",
            signalNote,
            positionWeight * 100,
            deployFraction * 100,
            amount.doubleValue(),
            qty.doubleValue()
        );

        return new DCARecommendation(input.symbol(), "BUY_MORE", amount, qty, confidence, rationale, "CONVICTION");
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
