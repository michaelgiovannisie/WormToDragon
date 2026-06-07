package com.conviction.assetdetail.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.assetdetail.dto.AssetDetailResponse;
import com.conviction.holding.dto.HoldingResponse;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;
import com.conviction.transaction.dto.TransactionResponse;
import com.conviction.transaction.repository.TransactionRepository;
import com.conviction.transaction.service.TransactionService;
import com.conviction.valuation.entity.ValuationScenario;
import com.conviction.valuation.repository.ValuationScenarioRepository;

@Service
public class AssetDetailService {

    private final HoldingRepository holdingRepository;
    private final TransactionService transactionService;
    private final ValuationScenarioRepository valuationScenarioRepository;
    private final TransactionRepository transactionRepository;
    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;

    public AssetDetailService(
        HoldingRepository holdingRepository,
        TransactionService transactionService,
        ValuationScenarioRepository valuationScenarioRepository,
        TransactionRepository transactionRepository,
        TaxLotRepository taxLotRepository,
        TaxLotAllocationRepository allocationRepository
    ) {
        this.holdingRepository = holdingRepository;
        this.transactionService = transactionService;
        this.valuationScenarioRepository = valuationScenarioRepository;
        this.transactionRepository = transactionRepository;
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;   
    }

    private HoldingResponse toHoldingResponse(Holding holding) {
        return new HoldingResponse(
                holding.getId(),
                holding.getAccount().getId(),
                holding.getAsset().getId(),
                holding.getAsset().getSymbol(),
                holding.getAsset().getName(),
                holding.getQuantityHeld(),
                holding.getTotalCostBasis(),
                holding.getQuantityHeld().compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : holding.getTotalCostBasis()
                                .divide(holding.getQuantityHeld(), 2, RoundingMode.HALF_UP),
                holding.getMarketPrice(),
                holding.getMarketValue(),
                holding.getUnrealizedGain(),
                holding.getTotalCostBasis().compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : holding.getUnrealizedGain()
                                .divide(holding.getTotalCostBasis(), 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100)),
                holding.getActive(),
                holding.getLastCalculatedAt()
        );
    }

    public AssetDetailResponse getAssetDetail(String symbol) {
        List<ValuationScenario> scenarios =
                valuationScenarioRepository
                        .findBySymbolOrderByCreatedAtDesc(symbol);

        List<TransactionResponse> transactions =
            transactionRepository
                    .findByAssetSymbolOrderByTransactionDateDesc(symbol)
                    .stream()
                    .map(transactionService::toResponse)
                    .toList();

        HoldingResponse holding =
            holdingRepository
                    .findActiveByAssetSymbolWithAssetAndAccount(symbol)
                    .stream()
                    .findFirst()
                    .map(this::toHoldingResponse)
                    .orElse(null);

        List<TaxLotResponse> taxLots =
        taxLotRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(this::toTaxLotResponse)
                .toList();

        List<TaxLotAllocationResponse> taxLotAllocations =
                allocationRepository
                        .findByAssetSymbolWithDetails(symbol.toUpperCase())
                        .stream()
                        .map(this::toTaxLotAllocationResponse)
                        .toList();

        return new AssetDetailResponse(
                symbol,
                symbol,
                holding,
                transactions,
                scenarios,
                taxLots,
                taxLotAllocations
        );
    }

    private TaxLotResponse toTaxLotResponse(TaxLot lot) {
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

    private TaxLotAllocationResponse toTaxLotAllocationResponse(
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