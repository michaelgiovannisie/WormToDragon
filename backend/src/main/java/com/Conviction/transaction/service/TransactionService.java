package com.conviction.transaction.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.conviction.account.entity.Account;
import com.conviction.account.repository.AccountRepository;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.holding.service.HoldingService;
import com.conviction.transaction.dto.CreateTransactionRequest;
import com.conviction.transaction.dto.TransactionResponse;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;
import com.conviction.transaction.repository.TransactionRepository;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final AssetRepository assetRepository;
    private final HoldingService holdingService;

    public TransactionService(
            TransactionRepository transactionRepository,
            AccountRepository accountRepository,
            AssetRepository assetRepository,
            HoldingService holdingService
    ) {
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
        this.assetRepository = assetRepository;
        this.holdingService = holdingService;
    }

    public TransactionResponse createTransaction(CreateTransactionRequest request) {
        Account account = accountRepository.findById(request.accountId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (request.quantity() == null ||
                request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero");
        }

        if (request.pricePerUnit() == null ||
                request.pricePerUnit().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price per unit cannot be negative");
        }

        if (request.fees() != null &&
                request.fees().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Fees cannot be negative");
        }

        if (request.transactionDate() == null) {
            throw new IllegalArgumentException("Transaction date is required");
        }

        if ((request.transactionType() == TransactionType.BUY ||
                request.transactionType() == TransactionType.SELL ||
                request.transactionType() == TransactionType.DIVIDEND)
                && request.assetId() == null) {
            throw new IllegalArgumentException("Asset is required for this transaction type");
        }

        Asset asset = null;

        if (request.assetId() != null) {
            asset = assetRepository.findById(request.assetId())
                    .orElseThrow(() -> new IllegalArgumentException("Asset not found"));
        }

        Transaction transaction = new Transaction();
        transaction.setAccount(account);
        transaction.setAsset(asset);
        transaction.setTransactionType(request.transactionType());
        transaction.setQuantity(request.quantity());
        transaction.setPricePerUnit(request.pricePerUnit());
        transaction.setFees(request.fees() == null ? BigDecimal.ZERO : request.fees());
        transaction.setTransactionDate(request.transactionDate());
        transaction.setNotes(request.notes());

        Transaction savedTransaction = transactionRepository.save(transaction);

        holdingService.updateHoldingFromTransaction(savedTransaction);

        return toResponse(savedTransaction);
    }

    public List<TransactionResponse> getTransactionsByAccountId(UUID accountId) {
        return transactionRepository.findByAccountId(accountId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private TransactionResponse toResponse(Transaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getAccount().getId(),
                transaction.getAsset() == null ? null : transaction.getAsset().getId(),
                transaction.getTransactionType(),
                transaction.getQuantity(),
                transaction.getPricePerUnit(),
                transaction.getFees(),
                transaction.getTransactionDate(),
                transaction.getNotes(),
                transaction.getRealizedGain(),
                transaction.getCreatedAt()
        );
    }

    public List<TransactionResponse> getTransactionsByAccountIdAndAssetSymbol(
            UUID accountId,
            String symbol
    ) {
        return transactionRepository
                .findByAccountIdAndAssetSymbol(accountId, symbol.toUpperCase())
                .stream()
                .map(this::toResponse)
                .toList();
    }
    
    public List<TransactionResponse>
    getTransactionsByAccountIdAndTypeAndAssetSymbol(
            UUID accountId,
            TransactionType transactionType,
            String symbol
    ) {
        return transactionRepository
                .findByAccountIdAndTransactionTypeAndAssetSymbol(
                        accountId,
                        transactionType,
                        symbol.toUpperCase()
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<TransactionResponse> getTransactionsByAccountIdAndDateRange(
            UUID accountId,
            LocalDate startDate,
            LocalDate endDate
    ) {
        return transactionRepository
                .findByAccountIdAndTransactionDateBetween(
                        accountId,
                        startDate,
                        endDate
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<TransactionResponse> getTransactionsByAccountIdAndType(
            UUID accountId,
            TransactionType transactionType
    ) {
        return transactionRepository
                .findByAccountIdAndTransactionType(accountId, transactionType)
                .stream()
                .map(this::toResponse)
                .toList();
    }

}