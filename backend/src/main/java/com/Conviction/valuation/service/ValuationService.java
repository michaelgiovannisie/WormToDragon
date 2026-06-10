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
        List<ValuationResponse> results = new java.util.ArrayList<>();

        // Preset assumptions — bear/base/bull
        // growth%, discount%, terminalGrowth%, exitMultiple (cross-check)
        record Preset(ValuationCaseType caseType, int growth, int discount, double termGrowth, int exitMult) {}
        List<Preset> presets = List.of(
                new Preset(ValuationCaseType.BEAR, 4,  11, 1.5, 14),
                new Preset(ValuationCaseType.BASE, 8,  10, 2.5, 20),
                new Preset(ValuationCaseType.BULL, 12,  9, 3.5, 26)
        );

        ValuationModelType modelType = request.modelType() != null ? request.modelType() : ValuationModelType.DCF;

        if (modelType == ValuationModelType.DCF && request.earningsPerShare() != null) {
            for (Preset p : presets) {
                ValuationRequest req = new ValuationRequest(
                        request.symbol(), ValuationModelType.DCF, p.caseType(),
                        request.currentPrice(), request.earningsPerShare(), null,
                        BigDecimal.valueOf(p.growth()), BigDecimal.valueOf(p.discount()), 10,
                        BigDecimal.valueOf(p.termGrowth()), BigDecimal.valueOf(p.exitMult()), null);
                ValuationResponse resp = calculate(req);
                persistScenario(req, resp);
                results.add(resp);
            }
        }

        BigDecimal fcf = request.freeCashFlowPerShare();
        if (modelType == ValuationModelType.OWNER_EARNINGS && fcf != null && fcf.compareTo(BigDecimal.ZERO) != 0) {
            for (Preset p : presets) {
                ValuationRequest req = new ValuationRequest(
                        request.symbol(), ValuationModelType.OWNER_EARNINGS, p.caseType(),
                        request.currentPrice(), null, fcf,
                        BigDecimal.valueOf(p.growth()), BigDecimal.valueOf(p.discount()), 10,
                        BigDecimal.valueOf(p.termGrowth()), BigDecimal.valueOf(p.exitMult()), null);
                ValuationResponse resp = calculate(req);
                persistScenario(req, resp);
                results.add(resp);
            }
        }

        return results;
    }

    private ValuationResponse calculate(ValuationRequest request) {
        ValuationStrategy strategy = resolveStrategy(request.modelType());
        BigDecimal intrinsicValue    = strategy.calculateIntrinsicValue(request);
        BigDecimal exitMultipleValue = strategy.calculateExitMultipleValue(request);

        BigDecimal marginOfSafetyPercent;
        String valuationLabel;

        if (request.modelType() == ValuationModelType.PEG) {
            // intrinsicValue IS the PEG ratio — MoS doesn't apply
            marginOfSafetyPercent = BigDecimal.ZERO;
            if (intrinsicValue.compareTo(BigDecimal.ONE) < 0) {
                valuationLabel = "UNDERVALUED";
            } else if (intrinsicValue.compareTo(BigDecimal.valueOf(2)) <= 0) {
                valuationLabel = "FAIRLY_VALUED";
            } else {
                valuationLabel = "OVERVALUED";
            }
        } else {
            marginOfSafetyPercent = intrinsicValue.compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.valueOf(-100)
                    : intrinsicValue.subtract(request.currentPrice())
                            .divide(intrinsicValue, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100));
            if (marginOfSafetyPercent.compareTo(BigDecimal.valueOf(20)) >= 0) {
                valuationLabel = "UNDERVALUED";
            } else if (marginOfSafetyPercent.compareTo(BigDecimal.valueOf(-10)) >= 0) {
                valuationLabel = "FAIRLY_VALUED";
            } else {
                valuationLabel = "OVERVALUED";
            }
        }

        return new ValuationResponse(
                request.symbol(),
                request.modelType(),
                request.caseType(),
                request.currentPrice(),
                request.growthRatePercent(),
                request.discountRatePercent(),
                request.years(),
                request.terminalGrowthRatePercent(),
                request.exitMultiple(),
                exitMultipleValue,
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
        scenario.setFreeCashFlowPerShare(request.freeCashFlowPerShare());
        scenario.setGrowthRatePercent(request.growthRatePercent());
        scenario.setDiscountRatePercent(request.discountRatePercent());
        scenario.setYears(request.years());
        scenario.setTerminalMultiple(null);                                        // legacy field — null for new scenarios
        scenario.setTerminalGrowthRatePercent(request.terminalGrowthRatePercent());
        scenario.setExitMultiple(request.exitMultiple());
        scenario.setExitMultipleValue(response.exitMultipleValue());
        scenario.setIntrinsicValue(response.intrinsicValue());
        scenario.setMarginOfSafetyPercent(response.marginOfSafetyPercent());
        scenario.setValuationLabel(response.valuationLabel());
        scenarioRepository.save(scenario);
    }
}
