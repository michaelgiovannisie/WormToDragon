package com.conviction.holding.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.holding.entity.Holding;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {

    Optional<Holding> findByAccountIdAndAssetId(UUID accountId, UUID assetId);

    List<Holding> findByAccountId(UUID accountId);

    List<Holding> findByAccountIdAndActiveTrue(UUID accountId);
}