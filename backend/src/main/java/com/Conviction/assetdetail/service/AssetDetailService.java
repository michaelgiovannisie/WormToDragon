package com.conviction.assetdetail.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.asset.entity.Equity;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.assetdetail.dto.AssetDetailResponse;
import com.conviction.holding.dto.HoldingResponse;
import com.conviction.holding.mapper.HoldingMapper;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.mapper.TaxLotMapper;
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
    private final HoldingMapper holdingMapper;
    private final TransactionService transactionService;
    private final ValuationScenarioRepository valuationScenarioRepository;
    private final TransactionRepository transactionRepository;
    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;
    private final TaxLotMapper taxLotMapper;
    private final AssetRepository assetRepository;

    public AssetDetailService(
        HoldingRepository holdingRepository,
        HoldingMapper holdingMapper,
        TransactionService transactionService,
        ValuationScenarioRepository valuationScenarioRepository,
        TransactionRepository transactionRepository,
        TaxLotRepository taxLotRepository,
        TaxLotAllocationRepository allocationRepository,
        TaxLotMapper taxLotMapper,
        AssetRepository assetRepository
    ) {
        this.holdingRepository = holdingRepository;
        this.holdingMapper = holdingMapper;
        this.transactionService = transactionService;
        this.valuationScenarioRepository = valuationScenarioRepository;
        this.transactionRepository = transactionRepository;
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
        this.taxLotMapper = taxLotMapper;
        this.assetRepository = assetRepository;
    }

    public AssetDetailResponse getAssetDetail(String symbol) {
        var asset = assetRepository.findBySymbol(symbol.toUpperCase());
        String assetName = asset.map(a -> a.getName() != null ? a.getName() : symbol).orElse(symbol);

        java.math.BigDecimal eps = null, fcfPerShare = null, revenueGrowthTTM = null;
        if (asset.isPresent() && asset.get() instanceof Equity eq) {
            eps              = eq.getEps();
            fcfPerShare      = eq.getFreeCashFlowPerShare();
            revenueGrowthTTM = eq.getRevenueGrowthTTM();
        }

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
                    .map(holdingMapper::toResponse)
                    .orElse(null);

        List<TaxLotResponse> taxLots =
        taxLotRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(taxLotMapper::toResponse)
                .toList();

        List<TaxLotAllocationResponse> taxLotAllocations =
                allocationRepository
                        .findByAssetSymbolWithDetails(symbol.toUpperCase())
                        .stream()
                        .map(taxLotMapper::toAllocationResponse)
                        .toList();

        return new AssetDetailResponse(
                symbol,
                assetName,
                holding,
                transactions,
                scenarios,
                taxLots,
                taxLotAllocations,
                eps,
                fcfPerShare,
                revenueGrowthTTM
        );
    }

}
