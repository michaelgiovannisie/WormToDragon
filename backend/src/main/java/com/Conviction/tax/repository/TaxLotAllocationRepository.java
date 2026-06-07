package com.conviction.tax.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.tax.entity.TaxLotAllocation;

public interface TaxLotAllocationRepository
        extends JpaRepository<TaxLotAllocation, UUID> {

    List<TaxLotAllocation> findBySellTransactionId(UUID sellTransactionId);

    boolean existsBySellTransactionId(UUID sellTransactionId);
}