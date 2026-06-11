package com.conviction.tax.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.portfolio.repository.PortfolioRepository;
import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.mapper.TaxLotMapper;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;
import com.conviction.tax.service.TaxLotService;

@RestController
@RequestMapping("/api/tax-lots")
public class TaxLotController {

    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;
    private final TaxLotMapper taxLotMapper;
    private final TaxLotService taxLotService;
    private final PortfolioRepository portfolioRepository;

    public TaxLotController(
            TaxLotRepository taxLotRepository,
            TaxLotAllocationRepository allocationRepository,
            TaxLotMapper taxLotMapper,
            TaxLotService taxLotService,
            PortfolioRepository portfolioRepository
    ) {
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
        this.taxLotMapper = taxLotMapper;
        this.taxLotService = taxLotService;
        this.portfolioRepository = portfolioRepository;
    }

    @GetMapping("/assets/{symbol}")
    public List<TaxLotResponse> getTaxLotsByAsset(
            @PathVariable String symbol
    ) {
        return taxLotRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(taxLotMapper::toResponse)
                .toList();
    }

    @GetMapping("/transactions/{sellTransactionId}/allocations")
    public List<TaxLotAllocationResponse> getAllocationsBySellTransaction(
            @PathVariable UUID sellTransactionId
    ) {
        return allocationRepository
                .findBySellTransactionIdWithDetails(sellTransactionId)
                .stream()
                .map(taxLotMapper::toAllocationResponse)
                .toList();
    }

    @GetMapping("/assets/{symbol}/allocations")
    public List<TaxLotAllocationResponse> getAllocationsByAsset(
            @PathVariable String symbol
    ) {
        return allocationRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(taxLotMapper::toAllocationResponse)
                .toList();
    }

    /**
     * Wipes and re-runs all tax-lot allocations for the portfolio using its
     * currently configured tax strategy (FIFO or LIFO). Safe to call any time
     * the user changes strategy.
     */
    @PostMapping("/rebuild/{portfolioId}")
    public ResponseEntity<Void> rebuildAllocations(@PathVariable UUID portfolioId) {
        var portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found: " + portfolioId));
        String strategy = portfolio.getTaxStrategy() != null ? portfolio.getTaxStrategy() : "FIFO";
        taxLotService.rebuildAllocationsForPortfolio(portfolioId, strategy);
        return ResponseEntity.ok().build();
    }

}
