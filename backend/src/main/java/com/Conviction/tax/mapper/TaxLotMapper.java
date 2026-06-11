package com.conviction.tax.mapper;

import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.entity.TaxLotAllocation;

import org.springframework.stereotype.Component;

@Component
public class TaxLotMapper {

    public TaxLotResponse toResponse(TaxLot lot) {
        return new TaxLotResponse(
                lot.getId(),
                lot.getAccount().getId(),
                lot.getAsset().getId(),
                lot.getAsset().getSymbol(),
                lot.getAsset().getName(),
                lot.getBuyTransaction().getId(),
                lot.getQuantityPurchased(),
                lot.getQuantityRemaining(),
                lot.getCostBasisPerUnit(),
                lot.getTotalCostBasis(),
                lot.getAcquisitionDate(),
                lot.getClosed(),
                lot.getClosedDate(),
                lot.getCreatedAt()
        );
    }

    public TaxLotAllocationResponse toAllocationResponse(
            TaxLotAllocation allocation
    ) {
        return new TaxLotAllocationResponse(
                allocation.getId(),
                allocation.getSellTransaction().getId(),
                allocation.getTaxLot().getId(),
                allocation.getTaxLot().getBuyTransaction().getId(),
                allocation.getQuantityAllocated(),
                allocation.getProceeds(),
                allocation.getCostBasis(),
                allocation.getRealizedGain(),
                allocation.getSellTransaction().getTransactionDate(),
                allocation.getCreatedAt()
        );
    }
}
