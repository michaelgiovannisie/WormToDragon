package com.conviction.tax.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.conviction.tax.entity.TaxLotAllocation;

public interface TaxLotAllocationRepository
        extends JpaRepository<TaxLotAllocation, UUID> {

    List<TaxLotAllocation> findBySellTransactionId(UUID sellTransactionId);

    boolean existsBySellTransactionId(UUID sellTransactionId);

    @Query("""
        SELECT allocation
        FROM TaxLotAllocation allocation
        JOIN FETCH allocation.sellTransaction
        JOIN FETCH allocation.taxLot lot
        JOIN FETCH lot.buyTransaction
        WHERE allocation.sellTransaction.id = :sellTransactionId
        ORDER BY allocation.createdAt ASC
        """)
    List<TaxLotAllocation> findBySellTransactionIdWithDetails(
            @Param("sellTransactionId") UUID sellTransactionId
    );
}