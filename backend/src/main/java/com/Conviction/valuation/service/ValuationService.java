package com.conviction.valuation.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.dto.ValuationResponse;
import com.conviction.valuation.entity.ValuationScenario;
import com.conviction.valuation.repository.ValuationScenarioRepository;

@Service
public class ValuationService {

    private final ValuationScenarioRepository scenarioRepository;

    public ValuationService(
            ValuationScenarioRepository scenarioRepository
    ) {
        this.scenarioRepository = scenarioRepository;
    }

    public List<ValuationScenario> getScenarios(String symbol) {
        return scenarioRepository.findBySymbolOrderByCreatedAtDesc(symbol);
    }

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

        ValuationScenario scenario = new ValuationScenario();

        scenario.setSymbol(request.symbol());
        scenario.setModelType(request.modelType());
        scenario.setCaseType(request.caseType());
        scenario.setCurrentPrice(request.currentPrice());
        scenario.setEarningsPerShare(request.earningsPerShare());
        scenario.setGrowthRatePercent(request.growthRatePercent());
        scenario.setDiscountRatePercent(request.discountRatePercent());
        scenario.setYears(request.years());
        scenario.setTerminalMultiple(request.terminalMultiple());
        scenario.setIntrinsicValue(intrinsicValue);
        scenario.setMarginOfSafetyPercent(marginOfSafetyPercent);
        scenario.setValuationLabel(valuationLabel);

        scenarioRepository.save(scenario);

        return new ValuationResponse(
                request.symbol(),
                request.modelType(),
                request.caseType(),
                request.currentPrice(),
                intrinsicValue,
                marginOfSafetyPercent,
                valuationLabel
        );
    }
}