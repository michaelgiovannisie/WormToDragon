package com.conviction.holding.controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.holding.dto.HoldingResponse;
import com.conviction.holding.dto.PortfolioHoldingResponse;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.holding.service.HoldingService;
import com.conviction.portfolio.dto.CashFlowTimelineResponse;
import com.conviction.portfolio.dto.PortfolioPerformanceResponse;
import com.conviction.portfolio.dto.PortfolioSummaryResponse;

@RestController
@RequestMapping("/api/holdings")
public class HoldingController {

    private final HoldingRepository holdingRepository;
    private final HoldingService holdingService;

    public HoldingController(
            HoldingRepository holdingRepository,
            HoldingService holdingService
    ) {
        this.holdingRepository = holdingRepository;
        this.holdingService = holdingService;
    }

    @GetMapping("/account/{accountId}")
    public List<HoldingResponse> getHoldingsByAccountId(@PathVariable UUID accountId) {
        return holdingRepository.findByAccountIdWithAssetAndAccount(accountId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/portfolio/{portfolioId}")
    public List<PortfolioHoldingResponse> getHoldingsByPortfolioId(@PathVariable UUID portfolioId) {
        return holdingService.getHoldingsByPortfolioId(portfolioId);
    }

    @GetMapping("/portfolio/{portfolioId}/summary")
    public PortfolioSummaryResponse getPortfolioSummary(@PathVariable UUID portfolioId) {
        return holdingService.getPortfolioSummary(portfolioId);
    }

    @GetMapping("/portfolio/{portfolioId}/performance")
    public List<PortfolioPerformanceResponse> getPortfolioPerformance(
            @PathVariable UUID portfolioId
    ) {
        return holdingService.getPortfolioPerformance(portfolioId);
    }

    @GetMapping("/portfolio/{portfolioId}/cash-flow")
    public List<CashFlowTimelineResponse> getCashFlowTimeline(
            @PathVariable UUID portfolioId
    ) {
        return holdingService.getCashFlowTimeline(portfolioId);
    }

    private HoldingResponse toResponse(Holding holding) {

        BigDecimal averageCostBasis =
                holding.getQuantityHeld().compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : holding.getTotalCostBasis()
                        .divide(
                                holding.getQuantityHeld(),
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal unrealizedGain =
        holding.getUnrealizedGain() == null
                ? BigDecimal.ZERO
                : holding.getUnrealizedGain();

        BigDecimal unrealizedGainPercent =
                holding.getTotalCostBasis().compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : unrealizedGain
                        .divide(
                                holding.getTotalCostBasis(),
                                4,
                                RoundingMode.HALF_UP
                        )
                        .multiply(BigDecimal.valueOf(100));

        return new HoldingResponse(
                holding.getId(),
                holding.getAccount().getId(),
                holding.getAsset().getId(),
                holding.getAsset().getSymbol(),
                holding.getAsset().getName(),
                holding.getQuantityHeld(),
                holding.getTotalCostBasis(),
                averageCostBasis,
                holding.getMarketPrice() == null ? BigDecimal.ZERO : holding.getMarketPrice(),
                holding.getMarketValue() == null ? BigDecimal.ZERO : holding.getMarketValue(),
                unrealizedGain,
                unrealizedGainPercent,
                holding.getActive(),
                holding.getLastCalculatedAt()
        );
    }
}