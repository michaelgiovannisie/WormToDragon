package com.conviction.tax.strategy;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.transaction.entity.Transaction;

/**
 * Specific Lot Identification — the user explicitly designates which lots
 * to sell and how many shares from each.
 *
 * The caller must supply lotSelections: a map of taxLotId → quantity to sell
 * from that lot. If the map is null or empty, falls back to FIFO.
 */
@Component
public class SpecificLotStrategy implements TaxStrategy {

    private final FIFOStrategy fifoFallback;

    public SpecificLotStrategy(FIFOStrategy fifoFallback) {
        this.fifoFallback = fifoFallback;
    }

    @Override
    public String getName() {
        return "SPECIFIC_LOT";
    }

    @Override
    public List<TaxLotAllocation> allocate(
            Transaction sellTransaction,
            List<TaxLot> openLots
    ) {
        // Without explicit selections, fall back to FIFO
        return fifoFallback.allocate(sellTransaction, openLots);
    }

    /**
     * Primary entry point when the user has provided explicit lot selections.
     * lotSelections: taxLotId → quantity to sell from that lot
     */
    public List<TaxLotAllocation> allocateWithSelections(
            Transaction sellTransaction,
            List<TaxLot> openLots,
            Map<UUID, BigDecimal> lotSelections
    ) {
        if (lotSelections == null || lotSelections.isEmpty()) {
            return fifoFallback.allocate(sellTransaction, openLots);
        }

        Map<UUID, TaxLot> lotById = openLots.stream()
                .collect(Collectors.toMap(TaxLot::getId, l -> l));

        List<TaxLotAllocation> allocations = new ArrayList<>();
        BigDecimal totalAllocated = BigDecimal.ZERO;

        for (Map.Entry<UUID, BigDecimal> entry : lotSelections.entrySet()) {
            TaxLot lot = lotById.get(entry.getKey());
            if (lot == null) {
                throw new IllegalArgumentException(
                        "Tax lot not found: " + entry.getKey()
                );
            }

            BigDecimal qty = entry.getValue();
            if (qty.compareTo(lot.getQuantityRemaining()) > 0) {
                throw new IllegalArgumentException(
                        "Requested quantity " + qty
                                + " exceeds remaining " + lot.getQuantityRemaining()
                                + " for lot " + lot.getId()
                );
            }

            BigDecimal proceeds = qty.multiply(sellTransaction.getPricePerUnit());
            BigDecimal costBasis = qty.multiply(lot.getCostBasisPerUnit());

            TaxLotAllocation allocation = new TaxLotAllocation();
            allocation.setSellTransaction(sellTransaction);
            allocation.setTaxLot(lot);
            allocation.setQuantityAllocated(qty);
            allocation.setProceeds(proceeds);
            allocation.setCostBasis(costBasis);
            allocation.setRealizedGain(proceeds.subtract(costBasis));

            allocations.add(allocation);

            lot.setQuantityRemaining(lot.getQuantityRemaining().subtract(qty));
            if (lot.getQuantityRemaining().compareTo(BigDecimal.ZERO) == 0) {
                lot.setClosed(true);
                lot.setClosedDate(sellTransaction.getTransactionDate());
            }

            totalAllocated = totalAllocated.add(qty);
        }

        if (totalAllocated.compareTo(sellTransaction.getQuantity()) != 0) {
            throw new IllegalArgumentException(
                    "Selected lot quantities (" + totalAllocated
                            + ") must equal sell quantity ("
                            + sellTransaction.getQuantity() + ")"
            );
        }

        return allocations;
    }
}
