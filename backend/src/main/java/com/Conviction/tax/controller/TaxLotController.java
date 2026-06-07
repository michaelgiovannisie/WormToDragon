package com.conviction.tax.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;

@RestController
@RequestMapping("/api/tax-lots")
public class TaxLotController {

    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;
    
    public TaxLotController(
            TaxLotRepository taxLotRepository,
            TaxLotAllocationRepository allocationRepository
    ) {
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
    }

    @GetMapping("/assets/{symbol}")
    public List<TaxLotResponse> getTaxLotsByAsset(
            @PathVariable String symbol
    ) {
        return taxLotRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/transactions/{sellTransactionId}/allocations")
    public List<TaxLotAllocationResponse> getAllocationsBySellTransaction(
            @PathVariable UUID sellTransactionId
    ) {
        return allocationRepository
                .findBySellTransactionIdWithDetails(sellTransactionId)
                .stream()
                .map(this::toAllocationResponse)
                .toList();
    }

    @GetMapping("/assets/{symbol}/allocations")
    public List<TaxLotAllocationResponse> getAllocationsByAsset(
            @PathVariable String symbol
    ) {
        return allocationRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(this::toAllocationResponse)
                .toList();
    }

    private TaxLotResponse toResponse(TaxLot lot) {
        return new TaxLotResponse(
                lot.getId(),
                lot.getAccount().getId(),
                lot.getAsset().getId(),
                lot.getAsset().getSymbol(),
                lot.getAsset().getName(),
                lot.getBuyTransaction().getId(),
                lot.getQuantityPurchased(),
                lot.getQuantityRemaining(),
                lot.getCostBasisPerUnit(),
                lot.getTotalCostBasis(),
                lot.getAcquisitionDate(),
                lot.getClosed(),
                lot.getCreatedAt()
        );
    }

    private TaxLotAllocationResponse toAllocationResponse(
            TaxLotAllocation allocation
    ) {
        return new TaxLotAllocationResponse(
                allocation.getId(),
                allocation.getSellTransaction().getId(),
                allocation.getTaxLot().getId(),
                allocation.getTaxLot().getBuyTransaction().getId(),
                allocation.getQuantityAllocated(),
                allocation.getProceeds(),
                allocation.getCostBasis(),
                allocation.getRealizedGain(),
                allocation.getCreatedAt()
        );
    }

}