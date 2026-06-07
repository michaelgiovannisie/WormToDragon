package com.conviction.asset.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.conviction.asset.entity.Asset;

public interface AssetRepository extends JpaRepository<Asset, UUID> {

    Optional<Asset> findBySymbol(String symbol);

    boolean existsBySymbol(String symbol);

    @Query("""
            SELECT asset
            FROM Asset asset
            WHERE asset.active = true
            AND (
                LOWER(asset.symbol) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(asset.name) LIKE LOWER(CONCAT('%', :query, '%'))
            )
            ORDER BY asset.symbol ASC
            """)
    List<Asset> searchActiveAssets(@Param("query") String query);
}
