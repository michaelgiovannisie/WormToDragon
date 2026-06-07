package com.conviction.tax.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.conviction.tax.entity.TaxLot;

public interface TaxLotRepository extends JpaRepository<TaxLot, UUID> {

    List<TaxLot> findByAccountIdAndAssetIdAndClosedFalseOrderByAcquisitionDateAscCreatedAtAsc(
            UUID accountId,
            UUID assetId
    );

    boolean existsByBuyTransactionId(UUID buyTransactionId);

    @Query("""
        SELECT lot
        FROM TaxLot lot
        JOIN FETCH lot.account
        JOIN FETCH lot.asset
        JOIN FETCH lot.buyTransaction
        WHERE lot.asset.symbol = :symbol
        ORDER BY lot.acquisitionDate ASC, lot.createdAt ASC
        """)
    List<TaxLot> findByAssetSymbolWithDetails(
            @Param("symbol") String symbol
    );

    @Modifying
    @Query("""
        DELETE FROM TaxLot lot
        WHERE lot.account.id = :accountId
        AND lot.asset.id = :assetId
        """)
    void deleteByAccountIdAndAssetId(
            @Param("accountId") UUID accountId,
            @Param("assetId") UUID assetId
    );
}
