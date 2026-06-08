package com.conviction.holding.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.conviction.holding.entity.Holding;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {

    Optional<Holding> findByAccountIdAndAssetId(UUID accountId, UUID assetId);

    void deleteByAccountIdAndAssetId(UUID accountId, UUID assetId);

    List<Holding> findByAccountId(UUID accountId);

    List<Holding> findByAccountIdAndActiveTrue(UUID accountId);

    List<Holding> findByAssetSymbol(String symbol);

    @Query("""
            SELECT h
            FROM Holding h
            JOIN FETCH h.asset
            JOIN FETCH h.account
            WHERE h.account.id = :accountId
            """)
    List<Holding> findByAccountIdWithAssetAndAccount(
            @Param("accountId") UUID accountId
    );

    @Query("""
        SELECT h
        FROM Holding h
        JOIN FETCH h.asset
        JOIN FETCH h.account a
        JOIN FETCH a.portfolio
        WHERE a.portfolio.id = :portfolioId
        AND h.active = true
        AND h.quantityHeld > 0.001
        """)
    List<Holding> findActiveByPortfolioIdWithAssetAndAccount(
            @Param("portfolioId") UUID portfolioId
    );

    @Query("""
        SELECT h
        FROM Holding h
        JOIN FETCH h.account a
        JOIN FETCH a.portfolio
        JOIN FETCH h.asset
        WHERE h.asset.symbol = :symbol
        """)
    List<Holding> findByAssetSymbolWithAccountAndPortfolio(
            @Param("symbol") String symbol
    );

    @Query("""
        SELECT h
        FROM Holding h
        JOIN FETCH h.asset
        JOIN FETCH h.account
        WHERE h.asset.symbol = :symbol
        AND h.active = true
        """)
    List<Holding> findActiveByAssetSymbolWithAssetAndAccount(
            @Param("symbol") String symbol
    );

    @Query("""
        SELECT DISTINCT h.asset.symbol
        FROM Holding h
        WHERE h.active = true
        AND h.quantityHeld > 0.001
        """)
    List<String> findActiveSymbols();
}
