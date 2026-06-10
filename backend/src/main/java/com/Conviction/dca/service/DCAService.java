package com.conviction.dca.service;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;

import com.conviction.dca.dto.DCAInput;
import com.conviction.dca.dto.DCARecommendation;
import com.conviction.dca.strategy.ConvictionDCAStrategy;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.valuation.entity.ValuationScenario;
import com.conviction.valuation.enums.ValuationCaseType;
import com.conviction.valuation.repository.ValuationScenarioRepository;

@Service
public class DCAService {

    private final HoldingRepository holdingRepository;
    private final ValuationScenarioRepository valuationRepository;
    private final ConvictionDCAStrategy strategy;

    public DCAService(
            HoldingRepository holdingRepository,
            ValuationScenarioRepository valuationRepository,
            ConvictionDCAStrategy strategy
    ) {
        this.holdingRepository  = holdingRepository;
        this.valuationRepository = valuationRepository;
        this.strategy            = strategy;
    }

    public DCARecommendation getRecommendation(String symbol, BigDecimal availableCash) {
        Holding holding = holdingRepository
                .findActiveByAssetSymbolWithAssetAndAccount(symbol)
                .stream()
                .findFirst()
                .orElse(null);

        // Prefer BASE case; fall back to most recent scenario
        ValuationScenario baseScenario = valuationRepository
                .findBySymbolOrderByCreatedAtDesc(symbol)
                .stream()
                .filter(s -> s.getCaseType() == ValuationCaseType.BASE)
                .findFirst()
                .orElseGet(() -> valuationRepository
                        .findBySymbolOrderByCreatedAtDesc(symbol)
                        .stream().findFirst().orElse(null));

        DCAInput input = new DCAInput(
                symbol,
                holding != null ? holding.getMarketPrice() : null,
                baseScenario != null ? baseScenario.getIntrinsicValue() : null,
                baseScenario != null ? baseScenario.getMarginOfSafetyPercent() : null,
                holding != null ? holding.getQuantityHeld() : BigDecimal.ZERO,
                holding != null ? holding.getTotalCostBasis() : BigDecimal.ZERO,
                null, // averageCostBasis not used by ConvictionDCAStrategy
                availableCash != null ? availableCash : BigDecimal.valueOf(1000)
        );

        return strategy.recommend(input);
    }
}
