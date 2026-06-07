package com.conviction.dca.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;
import com.conviction.dca.strategy.DCARecommendationStrategy;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.valuation.entity.ValuationScenario;
import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.repository.ValuationScenarioRepository;

@Service
public class DCAService {

    private final HoldingRepository holdingRepository;
    private final ValuationScenarioRepository valuationRepository;
    private final Map<String, DCARecommendationStrategy> strategies;

    public DCAService(
            HoldingRepository holdingRepository,
            ValuationScenarioRepository valuationRepository,
            List<DCARecommendationStrategy> strategyList
    ) {
        this.holdingRepository = holdingRepository;
        this.valuationRepository = valuationRepository;
        this.strategies = strategyList.stream()
                .collect(Collectors.toMap(
                        DCARecommendationStrategy::getName,
                        Function.identity()
                ));
    }

    public DCARecommendation getRecommendation(
            String symbol,
            String strategyName,
            BigDecimal availableCash
    ) {
        DCARecommendationStrategy strategy = strategies.getOrDefault(
                strategyName != null ? strategyName.toUpperCase() : "VALUE_FOCUSED",
                strategies.get("VALUE_FOCUSED")
        );

        Holding holding = holdingRepository
                .findActiveByAssetSymbolWithAssetAndAccount(symbol)
                .stream()
                .findFirst()
                .orElse(null);

        ValuationScenario baseScenario = valuationRepository
                .findBySymbolOrderByCreatedAtDesc(symbol)
                .stream()
                .filter(s -> s.getCaseType() == ValuationCaseType.BASE)
                .findFirst()
                .orElse(valuationRepository.findBySymbolOrderByCreatedAtDesc(symbol)
                        .stream().findFirst().orElse(null));

        DCAInput input = new DCAInput(
                symbol,
                holding != null ? holding.getMarketPrice() : null,
                baseScenario != null ? baseScenario.getIntrinsicValue() : null,
                baseScenario != null ? baseScenario.getMarginOfSafetyPercent() : null,
                holding != null ? holding.getQuantityHeld() : BigDecimal.ZERO,
                holding != null ? holding.getTotalCostBasis() : BigDecimal.ZERO,
                holding != null ? holding.getMarketPrice() : null,
                availableCash != null ? availableCash : BigDecimal.valueOf(1000)
        );

        return strategy.recommend(input);
    }

    public List<DCARecommendation> getAllRecommendations(
            String symbol,
            BigDecimal availableCash
    ) {
        return strategies.values().stream()
                .map(s -> getRecommendation(symbol, s.getName(), availableCash))
                .sorted((a, b) -> Integer.compare(b.confidenceScore(), a.confidenceScore()))
                .toList();
    }
}
