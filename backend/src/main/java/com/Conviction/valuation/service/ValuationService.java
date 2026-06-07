package com.conviction.valuation.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.valuation.dto.ValuationPresetRequest;
import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.dto.ValuationResponse;
import com.conviction.valuation.entity.ValuationScenario;
import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.enums.ValuationModelType;
import com.conviction.valuation.repository.ValuationScenarioRepository;
import com.conviction.valuation.strategy.ValuationStrategy;

@Service
public class ValuationService {

    private final ValuationScenarioRepository scenarioRepository;
    private final AssetRepository assetRepository;
    private final Map<ValuationModelType, ValuationStrategy> strategies;

    public ValuationService(
            ValuationScenarioRepository scenarioRepository,
            AssetRepository assetRepository,
            List<ValuationStrategy> strategyList
    ) {
        this.scenarioRepository = scenarioRepository;
        this.assetRepository = assetRepository;
        this.strategies = strategyList.stream()
                .collect(Collectors.toMap(
                        ValuationStrategy::getModelType,
                        Function.identity()
                ));
    }

    public List<ValuationScenario> getScenarios(String symbol) {
        return scenarioRepository.findBySymbolOrderByCreatedAtDesc(symbol);
    }

    public ValuationResponse calculateIntrinsicValue(ValuationRequest request) {
        ValuationResponse response = calculate(request);
        persistScenario(request, response);
        return response;
    }

    public List<ValuationResponse> calculatePresets(ValuationPresetRequest request) {
        return List.of(
                calculate(new ValuationRequest(
                        request.symbol(),
                        ValuationModelType.DCF,
                        ValuationCaseType.BEAR,
                        request.currentPrice(),
                        request.earningsPerShare(),
                        BigDecimal.valueOf(4),
                        BigDecimal.valueOf(11),
                        10,
                        BigDecimal.valueOf(16)
                )),
                calculate(new ValuationRequest(
                        request.symbol(),
                        ValuationModelType.DCF,
                        ValuationCaseType.BASE,
                        request.currentPrice(),
                        request.earningsPerShare(),
                        BigDecimal.valueOf(8),
                        BigDecimal.valueOf(10),
                        10,
                        BigDecimal.valueOf(22)
                )),
                calculate(new ValuationRequest(
                        request.symbol(),
                        ValuationModelType.DCF,
                        ValuationCaseType.BULL,
                        request.currentPrice(),
                        request.earningsPerShare(),
                        BigDecimal.valueOf(12),
                        BigDecimal.valueOf(9),
                        10,
                        BigDecimal.valueOf(28)
                ))
        );
    }

    private ValuationResponse calculate(ValuationRequest request) {
        ValuationStrategy strategy = resolveStrategy(request.modelType());
        BigDecimal intrinsicValue = strategy.calculateIntrinsicValue(request);

        BigDecimal marginOfSafetyPercent = intrinsicValue.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.valueOf(-100)
                : intrinsicValue.subtract(request.currentPrice())
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
                request.modelType(),
                request.caseType(),
                request.currentPrice(),
                request.growthRatePercent(),
                request.discountRatePercent(),
                request.years(),
                request.terminalMultiple(),
                intrinsicValue,
                marginOfSafetyPercent,
                valuationLabel
        );
    }

    private ValuationStrategy resolveStrategy(ValuationModelType modelType) {
        ValuationStrategy strategy = strategies.get(modelType);
        if (strategy == null) {
            // fall back to DCF for legacy model types
            strategy = strategies.get(ValuationModelType.DCF);
        }
        return strategy;
    }

    private void persistScenario(ValuationRequest request, ValuationResponse response) {
        Asset asset = assetRepository.findBySymbol(request.symbol()).orElse(null);

        ValuationScenario scenario = new ValuationScenario();
        scenario.setSymbol(request.symbol());
        scenario.setAsset(asset);
        scenario.setModelType(request.modelType());
        scenario.setCaseType(request.caseType());
        scenario.setCurrentPrice(request.currentPrice());
        scenario.setEarningsPerShare(request.earningsPerShare());
        scenario.setGrowthRatePercent(request.growthRatePercent());
        scenario.setDiscountRatePercent(request.discountRatePercent());
        scenario.setYears(request.years());
        scenario.setTerminalMultiple(request.terminalMultiple());
        scenario.setIntrinsicValue(response.intrinsicValue());
        scenario.setMarginOfSafetyPercent(response.marginOfSafetyPercent());
        scenario.setValuationLabel(response.valuationLabel());
        scenarioRepository.save(scenario);
    }
}
