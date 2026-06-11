package com.conviction.tax.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;
import com.conviction.tax.strategy.TaxStrategy;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;
import com.conviction.transaction.repository.TransactionRepository;

@Service
public class TaxLotService {

    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;
    private final TransactionRepository transactionRepository;
    private final Map<String, TaxStrategy> strategies;

    public TaxLotService(
            TaxLotRepository taxLotRepository,
            TaxLotAllocationRepository allocationRepository,
            TransactionRepository transactionRepository,
            List<TaxStrategy> strategyList
    ) {
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
        this.transactionRepository = transactionRepository;
        this.strategies = strategyList.stream()
                .collect(Collectors.toMap(
                        TaxStrategy::getName,
                        Function.identity()
                ));
    }

    @Transactional
    public void processTransaction(Transaction transaction) {
        if (transaction.getTransactionType() == TransactionType.BUY) {
            createLotFromBuy(transaction);
        }
        if (transaction.getTransactionType() == TransactionType.SELL) {
            allocateSell(transaction, resolvePortfolioStrategyName(transaction));
        }
    }

    /**
     * Resolves the tax strategy name from the owning portfolio's configured
     * taxStrategy field, falling back to FIFO if it's missing or unrecognized.
     */
    private String resolvePortfolioStrategyName(Transaction transaction) {
        String configured = transaction.getAccount() == null
                ? null
                : transaction.getAccount().getPortfolio() == null
                        ? null
                        : transaction.getAccount().getPortfolio().getTaxStrategy();

        if (configured == null || !strategies.containsKey(configured)) {
            return "FIFO";
        }

        return configured;
    }

    @Transactional
    public void processTransaction(Transaction transaction, String strategyName) {
        if (transaction.getTransactionType() == TransactionType.BUY) {
            createLotFromBuy(transaction);
        }
        if (transaction.getTransactionType() == TransactionType.SELL) {
            allocateSell(transaction, strategyName);
        }
    }

    private void createLotFromBuy(Transaction transaction) {
        if (taxLotRepository.existsByBuyTransactionId(transaction.getId())) {
            return;
        }

        BigDecimal totalCostBasis = transaction.getQuantity()
                .multiply(transaction.getPricePerUnit())
                .add(transaction.getFees());

        TaxLot lot = new TaxLot();
        lot.setBuyTransaction(transaction);
        lot.setAccount(transaction.getAccount());
        lot.setAsset(transaction.getAsset());
        lot.setQuantityPurchased(transaction.getQuantity());
        lot.setQuantityRemaining(transaction.getQuantity());
        lot.setCostBasisPerUnit(
                totalCostBasis.divide(
                        transaction.getQuantity(), 4, java.math.RoundingMode.HALF_UP
                )
        );
        lot.setTotalCostBasis(totalCostBasis);
        lot.setAcquisitionDate(transaction.getTransactionDate());
        lot.setClosed(false);

        taxLotRepository.save(lot);
    }

    /**
     * Wipe all allocations for the portfolio and re-run them in transaction-date
     * order using the given strategy. Lot quantities and closed state are reset
     * before replay so the result is identical to a fresh import.
     */
    @Transactional
    public void rebuildAllocationsForPortfolio(UUID portfolioId, String strategyName) {
        // 1. Delete every allocation that belongs to this portfolio
        allocationRepository.deleteByPortfolioId(portfolioId);

        // 2. Reset every lot back to its original state
        List<TaxLot> lots = taxLotRepository.findByPortfolioId(portfolioId);
        for (TaxLot lot : lots) {
            lot.setClosed(false);
            lot.setClosedDate(null);
            lot.setQuantityRemaining(lot.getQuantityPurchased());
            taxLotRepository.save(lot);
        }

        // 3. Re-allocate every SELL in chronological order (query is already ordered)
        List<Transaction> sellTransactions = transactionRepository
                .findByAccountPortfolioId(portfolioId)
                .stream()
                .filter(t -> t.getTransactionType() == TransactionType.SELL)
                .toList();

        for (Transaction t : sellTransactions) {
            allocateSell(t, strategyName);
        }
    }

    private void allocateSell(Transaction transaction, String strategyName) {
        if (allocationRepository.existsBySellTransactionId(transaction.getId())) {
            return;
        }

        TaxStrategy strategy = strategies.getOrDefault(strategyName, strategies.get("FIFO"));

        List<TaxLot> openLots =
                taxLotRepository
                        .findByAccountIdAndAssetIdAndClosedFalseOrderByAcquisitionDateAscCreatedAtAsc(
                                transaction.getAccount().getId(),
                                transaction.getAsset().getId()
                        );

        List<TaxLotAllocation> allocations = strategy.allocate(transaction, openLots);

        BigDecimal totalRealizedGain = BigDecimal.ZERO;
        for (TaxLotAllocation allocation : allocations) {
            allocationRepository.save(allocation);
            taxLotRepository.save(allocation.getTaxLot());
            totalRealizedGain = totalRealizedGain.add(allocation.getRealizedGain());
        }

        transaction.setRealizedGain(totalRealizedGain);
    }
}
