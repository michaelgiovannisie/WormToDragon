package com.conviction.tax.service;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;

@Service
public class TaxLotService {

    private final TaxLotRepository taxLotRepository;
    private final TaxLotAllocationRepository allocationRepository;

    public TaxLotService(
            TaxLotRepository taxLotRepository,
            TaxLotAllocationRepository allocationRepository
    ) {
        this.taxLotRepository = taxLotRepository;
        this.allocationRepository = allocationRepository;
    }

    public void processTransaction(Transaction transaction) {
        if (transaction.getTransactionType() == TransactionType.BUY) {
            createLotFromBuy(transaction);
        }

        if (transaction.getTransactionType() == TransactionType.SELL) {
            allocateSellFifo(transaction);
        }
    }

    private void createLotFromBuy(Transaction transaction) {
        if (taxLotRepository.existsByBuyTransactionId(transaction.getId())) {
            return;
        }

        BigDecimal totalCostBasis =
                transaction.getQuantity()
                        .multiply(transaction.getPricePerUnit())
                        .add(transaction.getFees());

        TaxLot taxLot = new TaxLot();

        taxLot.setBuyTransaction(transaction);
        taxLot.setAccount(transaction.getAccount());
        taxLot.setAsset(transaction.getAsset());
        taxLot.setQuantityPurchased(transaction.getQuantity());
        taxLot.setQuantityRemaining(transaction.getQuantity());
        taxLot.setCostBasisPerUnit(transaction.getPricePerUnit());
        taxLot.setTotalCostBasis(totalCostBasis);
        taxLot.setAcquisitionDate(transaction.getTransactionDate());
        taxLot.setClosed(false);

        taxLotRepository.save(taxLot);
    }

    private void allocateSellFifo(Transaction transaction) {
        if (allocationRepository.existsBySellTransactionId(transaction.getId())) {
            return;
        }

        BigDecimal quantityToSell = transaction.getQuantity();

        List<TaxLot> openLots =
                taxLotRepository
                        .findByAccountIdAndAssetIdAndClosedFalseOrderByAcquisitionDateAscCreatedAtAsc(
                                transaction.getAccount().getId(),
                                transaction.getAsset().getId()
                        );

        BigDecimal totalRealizedGain = BigDecimal.ZERO;

        for (TaxLot lot : openLots) {
            if (quantityToSell.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }

            BigDecimal quantityFromLot =
                    lot.getQuantityRemaining().min(quantityToSell);

            BigDecimal proceeds =
                    quantityFromLot.multiply(transaction.getPricePerUnit());

            BigDecimal costBasis =
                    quantityFromLot.multiply(lot.getCostBasisPerUnit());

            BigDecimal realizedGain =
                    proceeds.subtract(costBasis);

            TaxLotAllocation allocation = new TaxLotAllocation();

            allocation.setSellTransaction(transaction);
            allocation.setTaxLot(lot);
            allocation.setQuantityAllocated(quantityFromLot);
            allocation.setProceeds(proceeds);
            allocation.setCostBasis(costBasis);
            allocation.setRealizedGain(realizedGain);

            allocationRepository.save(allocation);

            BigDecimal remainingQuantity =
                    lot.getQuantityRemaining().subtract(quantityFromLot);

            lot.setQuantityRemaining(remainingQuantity);

            if (remainingQuantity.compareTo(BigDecimal.ZERO) == 0) {
                lot.setClosed(true);
            }

            taxLotRepository.save(lot);

            totalRealizedGain =
                    totalRealizedGain.add(realizedGain);

            quantityToSell =
                    quantityToSell.subtract(quantityFromLot);
        }

        if (quantityToSell.compareTo(BigDecimal.ZERO) > 0) {
            throw new IllegalArgumentException(
                    "Not enough tax lot quantity available for sell"
            );
        }

        transaction.setRealizedGain(totalRealizedGain);
    }
}