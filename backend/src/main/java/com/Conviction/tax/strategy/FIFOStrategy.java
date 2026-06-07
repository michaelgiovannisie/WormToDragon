package com.conviction.tax.strategy;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.transaction.entity.Transaction;

/**
 * First In, First Out — oldest lots are consumed before newer ones.
 */
@Component
public class FIFOStrategy implements TaxStrategy {

    @Override
    public String getName() {
        return "FIFO";
    }

    @Override
    public List<TaxLotAllocation> allocate(
            Transaction sellTransaction,
            List<TaxLot> openLots
    ) {
        List<TaxLot> ordered = openLots.stream()
                .sorted(Comparator.comparing(TaxLot::getAcquisitionDate)
                        .thenComparing(TaxLot::getCreatedAt))
                .toList();

        return allocateOrdered(sellTransaction, ordered);
    }

    static List<TaxLotAllocation> allocateOrdered(
            Transaction sellTransaction,
            List<TaxLot> orderedLots
    ) {
        BigDecimal quantityToSell = sellTransaction.getQuantity();
        List<TaxLotAllocation> allocations = new ArrayList<>();

        for (TaxLot lot : orderedLots) {
            if (quantityToSell.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal fromLot = lot.getQuantityRemaining().min(quantityToSell);
            BigDecimal proceeds = fromLot.multiply(sellTransaction.getPricePerUnit());
            BigDecimal costBasis = fromLot.multiply(lot.getCostBasisPerUnit());

            TaxLotAllocation allocation = new TaxLotAllocation();
            allocation.setSellTransaction(sellTransaction);
            allocation.setTaxLot(lot);
            allocation.setQuantityAllocated(fromLot);
            allocation.setProceeds(proceeds);
            allocation.setCostBasis(costBasis);
            allocation.setRealizedGain(proceeds.subtract(costBasis));

            allocations.add(allocation);

            lot.setQuantityRemaining(lot.getQuantityRemaining().subtract(fromLot));
            if (lot.getQuantityRemaining().compareTo(BigDecimal.ZERO) == 0) {
                lot.setClosed(true);
            }

            quantityToSell = quantityToSell.subtract(fromLot);
        }

        if (quantityToSell.compareTo(BigDecimal.ZERO) > 0) {
            throw new IllegalArgumentException(
                    "Not enough tax lot quantity to cover sell of "
                            + sellTransaction.getQuantity()
            );
        }

        return allocations;
    }
}
