package com.conviction.transaction.service;

import java.math.BigDecimal;
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

        Asset asset = assetRepository.findById(request.assetId())
                .orElseThrow(() -> new IllegalArgumentException("Asset not found"));

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
                transaction.getCreatedAt()
        );
    }
}