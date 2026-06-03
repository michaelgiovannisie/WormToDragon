package com.conviction.asset.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.asset.entity.Asset;

public interface AssetRepository extends JpaRepository<Asset, UUID> {

    Optional<Asset> findBySymbol(String symbol);

    boolean existsBySymbol(String symbol);
}