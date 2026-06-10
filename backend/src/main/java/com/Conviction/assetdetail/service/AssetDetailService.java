package com.conviction.assetdetail.service;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.asset.entity.Equity;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.assetdetail.dto.AssetDetailResponse;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;
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
    private final HistoricalPriceRepository historicalPriceRepository;

    public AssetDetailService(
        HoldingRepository holdingRepository,
        HoldingMapper holdingMapper,
        TransactionService transactionService,
        ValuationScenarioRepository valuationScenarioRepository,
        TransactionRepository transactionRepository,
        TaxLotRepository taxLotRepository,
        TaxLotAllocationRepository allocationRepository,
        TaxLotMapper taxLotMapper,
        AssetRepository assetRepository,
        HistoricalPriceRepository historicalPriceRepository
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
        this.historicalPriceRepository = historicalPriceRepository;
    }

    public AssetDetailResponse getAssetDetail(String symbol) {
        var asset = assetRepository.findBySymbol(symbol.toUpperCase());
        String assetName = asset.map(a -> a.getName() != null ? a.getName() : symbol).orElse(symbol);

        BigDecimal eps = null, fcfPerShare = null, epsGrowth = null, bookValuePerShare = null, dividendPerShare = null;
        if (asset.isPresent() && asset.get() instanceof Equity eq) {
            eps              = eq.getEps();
            fcfPerShare      = eq.getFreeCashFlowPerShare();
            epsGrowth        = eq.getEpsGrowth();
            bookValuePerShare = eq.getBookValuePerShare();
            dividendPerShare  = eq.getDividendPerShare();
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

        // Latest price — independent of whether the asset is currently held.
        // Prefer the active holding's market price (most recently refreshed);
        // fall back to the most recent historical close.
        BigDecimal latestPrice = holding != null ? holding.marketPrice() : null;
        if (latestPrice == null) {
            latestPrice = historicalPriceRepository
                    .findTopByAssetSymbolOrderByPriceDateDesc(symbol.toUpperCase())
                    .map(hp -> hp.getClose())
                    .orElse(null);
        }

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
                epsGrowth,
                bookValuePerShare,
                dividendPerShare,
                latestPrice
        );
    }

}
