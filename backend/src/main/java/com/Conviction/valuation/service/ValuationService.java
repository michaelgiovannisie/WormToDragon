package com.conviction.valuation.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Service;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.dto.ValuationResponse;

@Service
public class ValuationService {

    public ValuationResponse calculateIntrinsicValue(
            ValuationRequest request
    ) {
        BigDecimal growthRate = request.growthRatePercent()
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal discountRate = request.discountRatePercent()
                .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);

        BigDecimal futureEps = request.earningsPerShare()
                .multiply(
                        BigDecimal.ONE.add(growthRate)
                                .pow(request.years())
                );

        BigDecimal futureValue =
                futureEps.multiply(request.terminalMultiple());

        BigDecimal discountFactor =
                BigDecimal.ONE.add(discountRate)
                        .pow(request.years());

        BigDecimal intrinsicValue =
                futureValue.divide(discountFactor, 2, RoundingMode.HALF_UP);

        BigDecimal marginOfSafetyPercent =
                intrinsicValue.subtract(request.currentPrice())
                        .divide(intrinsicValue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));

        String valuationLabel;

        if (marginOfSafetyPercent.compareTo(BigDecimal.valueOf(20)) >= 0) {
            valuationLabel = "UNDERVALUED";
        } else if (marginOfSafetyPercent.compareTo(BigDecimal.valueOf(-10)) >= 0) {
            valuationLabel = "FAIRLY_VALUED";
        } else {
            valuationLabel = "OVERVALUED";
        }

        return new ValuationResponse(
                request.symbol(),
                request.currentPrice(),
                intrinsicValue,
                marginOfSafetyPercent,
                valuationLabel
        );
    }
}