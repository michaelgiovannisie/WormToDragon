package com.conviction.projection.service;

import com.conviction.holding.repository.HoldingRepository;
import com.conviction.holding.service.HoldingService;
import com.conviction.projection.dto.RebuildProjectionResponse;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;
import com.conviction.tax.service.TaxLotService;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.repository.TransactionRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class ProjectionRebuildService {

    private final TransactionRepository transactionRepository;
    private final HoldingRepository holdingRepository;
    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;
    private final TaxLotService taxLotService;
    private final HoldingService holdingService;

    public ProjectionRebuildService(
            TransactionRepository transactionRepository,
            HoldingRepository holdingRepository,
            TaxLotRepository taxLotRepository,
            TaxLotAllocationRepository allocationRepository,
            TaxLotService taxLotService,
            HoldingService holdingService
    ) {
        this.transactionRepository = transactionRepository;
        this.holdingRepository = holdingRepository;
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
        this.taxLotService = taxLotService;
        this.holdingService = holdingService;
    }

    @Transactional
    public RebuildProjectionResponse rebuildAccountAsset(
            UUID accountId,
            UUID assetId
    ) {
        List<Transaction> transactions =
                transactionRepository.findByAccountIdAndAssetIdForReplay(
                        accountId,
                        assetId
                );

        if (transactions.isEmpty()) {
            throw new IllegalArgumentException(
                    "No transactions found for account and asset"
            );
        }

        allocationRepository.deleteByAccountIdAndAssetId(accountId, assetId);
        taxLotRepository.deleteByAccountIdAndAssetId(accountId, assetId);
        holdingRepository.deleteByAccountIdAndAssetId(accountId, assetId);

        for (Transaction transaction : transactions) {
            transaction.setRealizedGain(BigDecimal.ZERO);
            taxLotService.processTransaction(transaction);
            holdingService.updateHoldingFromTransaction(transaction);
            transactionRepository.save(transaction);
        }

        Transaction firstTransaction = transactions.get(0);

        return new RebuildProjectionResponse(
                accountId,
                assetId,
                firstTransaction.getAsset().getSymbol(),
                transactions.size(),
                "REBUILT"
        );
    }
}
