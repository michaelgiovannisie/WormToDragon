package com.conviction.tax.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.tax.entity.TaxLot;

public interface TaxLotRepository extends JpaRepository<TaxLot, UUID> {

    List<TaxLot> findByAccountIdAndAssetIdAndClosedFalseOrderByAcquisitionDateAscCreatedAtAsc(
            UUID accountId,
            UUID assetId
    );

    boolean existsByBuyTransactionId(UUID buyTransactionId);
}