package com.conviction.tax.strategy;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.transaction.entity.Transaction;

/**
 * Last In, First Out — newest lots are consumed first.
 * Can reduce short-term capital gains exposure in rising markets
 * by selling most recently purchased (lower-gain) lots first.
 */
@Component
public class LIFOStrategy implements TaxStrategy {

    @Override
    public String getName() {
        return "LIFO";
    }

    @Override
    public List<TaxLotAllocation> allocate(
            Transaction sellTransaction,
            List<TaxLot> openLots
    ) {
        List<TaxLot> ordered = openLots.stream()
                .sorted(Comparator.comparing(TaxLot::getAcquisitionDate).reversed()
                        .thenComparing(Comparator.comparing(TaxLot::getCreatedAt).reversed()))
                .toList();

        return FIFOStrategy.allocateOrdered(sellTransaction, ordered);
    }
}
