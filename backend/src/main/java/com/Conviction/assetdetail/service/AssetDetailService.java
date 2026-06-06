package com.conviction.assetdetail.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.assetdetail.dto.AssetDetailResponse;
import com.conviction.holding.repository.HoldingRepository;
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

    public AssetDetailService(
        HoldingRepository holdingRepository,
        TransactionService transactionService,
        ValuationScenarioRepository valuationScenarioRepository,
        TransactionRepository transactionRepository
    ) {
        this.holdingRepository = holdingRepository;
        this.transactionService = transactionService;
        this.valuationScenarioRepository = valuationScenarioRepository;
        this.transactionRepository = transactionRepository;
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

        return new AssetDetailResponse(
                symbol,
                symbol,
                null,
                transactions,
                scenarios
        );
    }
}