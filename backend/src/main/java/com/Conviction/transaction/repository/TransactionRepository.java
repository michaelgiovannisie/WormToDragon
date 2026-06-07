package com.conviction.transaction.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;

public interface TransactionRepository
        extends JpaRepository<Transaction, UUID> {

    List<Transaction> findByAccountId(UUID accountId);

    List<Transaction> findByAssetId(UUID assetId);

    List<Transaction> findByAccountPortfolioId(UUID portfolioId);

    List<Transaction> findByAccountIdAndTransactionType(
            UUID accountId,
            TransactionType transactionType
    );

    List<Transaction> findByAccountIdAndAssetSymbol(
            UUID accountId,
            String symbol
    );

    List<Transaction> findByAccountIdAndTransactionTypeAndAssetSymbol(
            UUID accountId,
            TransactionType transactionType,
            String symbol
    );

    List<Transaction> findByAccountIdAndTransactionDateBetween(
            UUID accountId,
            LocalDate startDate,
            LocalDate endDate
    );

    @Query("""
        SELECT t
        FROM Transaction t
        JOIN FETCH t.asset a
        JOIN FETCH t.account
        WHERE a.symbol = :symbol
        ORDER BY t.transactionDate DESC
        """)
        List<Transaction> findByAssetSymbolOrderByTransactionDateDesc(
                @Param("symbol") String symbol
        );

    boolean existsByAccountIdAndAssetIdAndTransactionTypeAndQuantityAndPricePerUnitAndTransactionDate(
                UUID accountId,
                UUID assetId,
                TransactionType transactionType,
                BigDecimal quantity,
                BigDecimal pricePerUnit,
                LocalDate transactionDate
        );

    @Query("""
        SELECT t
        FROM Transaction t
        LEFT JOIN FETCH t.asset
        JOIN FETCH t.account
        WHERE t.account.id = :accountId
        """)
        List<Transaction> findByAccountIdWithAssetAndAccount(
                @Param("accountId") UUID accountId
        );

    @Query("""
        SELECT t
        FROM Transaction t
        JOIN FETCH t.account
        JOIN FETCH t.asset
        WHERE t.account.id = :accountId
        AND t.asset.id = :assetId
        ORDER BY t.transactionDate ASC, t.createdAt ASC
        """)
        List<Transaction> findByAccountIdAndAssetIdForReplay(
                @Param("accountId") UUID accountId,
                @Param("assetId") UUID assetId
        );
}
