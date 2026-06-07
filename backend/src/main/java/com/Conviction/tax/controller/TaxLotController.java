package com.conviction.tax.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.mapper.TaxLotMapper;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;

@RestController
@RequestMapping("/api/tax-lots")
public class TaxLotController {

    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;
    private final TaxLotMapper taxLotMapper;
    
    public TaxLotController(
            TaxLotRepository taxLotRepository,
            TaxLotAllocationRepository allocationRepository,
            TaxLotMapper taxLotMapper
    ) {
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
        this.taxLotMapper = taxLotMapper;
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

}
