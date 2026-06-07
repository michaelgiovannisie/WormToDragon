package com.conviction.valuation.strategy;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

/**
 * Crypto Risk-Adjusted Intrinsic Value:
 *   Applies a standard DCF but discounts heavily for crypto-specific risk.
 *   The discountRatePercent is treated as a risk-adjusted rate (typically 20–50%
 *   for crypto vs 8–12% for equities).
 *
 *   Formula is the same as DCF but the caller is expected to supply a much
 *   higher discount rate to reflect volatility and binary risk.
 *
 *   Additionally applies a crypto risk haircut of 20% to the final value
 *   to account for regulatory, liquidity, and protocol risk.
 *
 * Uses: earningsPerShare (or revenue/token), growthRatePercent,
 *       discountRatePercent (high, e.g. 30%), years, terminalMultiple
 */
@Component
public class CryptoRiskStrategy implements ValuationStrategy {

    private static final BigDecimal CRYPTO_RISK_HAIRCUT =
            BigDecimal.valueOf(0.80); // 20% haircut

    @Override
    public ValuationModelType getModelType() {
        return ValuationModelType.CRYPTO_RISK;
    }

    @Override
    public BigDecimal calculateIntrinsicValue(ValuationRequest request) {
        BigDecimal g = request.growthRatePercent()
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal d = request.discountRatePercent()
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal futureValue = request.earningsPerShare()
                .multiply(BigDecimal.ONE.add(g).pow(request.years()))
                .multiply(request.terminalMultiple());

        BigDecimal discountFactor = BigDecimal.ONE.add(d).pow(request.years());

        BigDecimal dcfValue = futureValue.divide(
                discountFactor, 2, RoundingMode.HALF_UP
        );

        return dcfValue.multiply(CRYPTO_RISK_HAIRCUT)
                .setScale(2, RoundingMode.HALF_UP);
    }
}
