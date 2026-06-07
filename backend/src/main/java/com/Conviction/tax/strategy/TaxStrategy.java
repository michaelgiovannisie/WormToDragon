package com.conviction.tax.strategy;

import java.util.List;

import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.transaction.entity.Transaction;

public interface TaxStrategy {

    String getName();

    /**
     * Allocates a SELL transaction against the provided open lots.
     * Returns the list of allocations created. The caller is responsible
     * for persisting them.
     */
    List<TaxLotAllocation> allocate(
            Transaction sellTransaction,
            List<TaxLot> openLots
    );
}
