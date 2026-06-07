package com.conviction.holding.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.holding.dto.HoldingResponse;
import com.conviction.holding.dto.PortfolioHoldingResponse;
import com.conviction.holding.mapper.HoldingMapper;
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
    private final HoldingMapper holdingMapper;

    public HoldingController(
            HoldingRepository holdingRepository,
            HoldingService holdingService,
            HoldingMapper holdingMapper
    ) {
        this.holdingRepository = holdingRepository;
        this.holdingService = holdingService;
        this.holdingMapper = holdingMapper;
    }

    @GetMapping("/account/{accountId}")
    public List<HoldingResponse> getHoldingsByAccountId(@PathVariable UUID accountId) {
        return holdingRepository.findByAccountIdWithAssetAndAccount(accountId)
                .stream()
                .map(holdingMapper::toResponse)
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

}
