package com.conviction.transaction.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

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
}