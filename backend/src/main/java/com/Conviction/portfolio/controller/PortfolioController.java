package com.conviction.portfolio.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.portfolio.dto.CreatePortfolioRequest;
import com.conviction.portfolio.dto.PortfolioResponse;
import com.conviction.portfolio.service.PortfolioService;

@RestController
@RequestMapping("/api/portfolios")
public class PortfolioController {

    private final PortfolioService portfolioService;

    public PortfolioController(PortfolioService portfolioService) {
        this.portfolioService = portfolioService;
    }

    @PostMapping
    public PortfolioResponse createPortfolio(@RequestBody CreatePortfolioRequest request) {
        return portfolioService.createPortfolio(request);
    }

    @GetMapping("/{portfolioId}")
    public PortfolioResponse getPortfolio(@PathVariable UUID portfolioId) {
        return portfolioService.getPortfolio(portfolioId);
    }

    @GetMapping("/user/{userId}")
    public List<PortfolioResponse> getPortfoliosByUserId(@PathVariable UUID userId) {
        return portfolioService.getPortfoliosByUserId(userId);
    }

    @PatchMapping("/{portfolioId}/tax-strategy")
    public PortfolioResponse updateTaxStrategy(
            @PathVariable UUID portfolioId,
            @RequestBody Map<String, String> body
    ) {
        return portfolioService.updateTaxStrategy(portfolioId, body.get("taxStrategy"));
    }
}
