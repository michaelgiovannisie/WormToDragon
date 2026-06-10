package com.conviction.transaction.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.conviction.account.entity.Account;
import com.conviction.account.repository.AccountRepository;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.holding.service.HoldingService;
import com.conviction.tax.service.TaxLotService;
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
    private final TaxLotService taxLotService;
    private final HoldingService holdingService;

    public TransactionService(
        TransactionRepository transactionRepository,
        AccountRepository accountRepository,
        AssetRepository assetRepository,
        HoldingService holdingService,
        TaxLotService taxLotService
        ) {
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
        this.assetRepository = assetRepository;
        this.holdingService = holdingService;
        this.taxLotService = taxLotService;
    }

    @Transactional
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

        if (request.transactionType() == TransactionType.DIVIDEND
                && request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Dividend quantity must be greater than zero"
            );
        }

        Asset asset = null;

        if (request.assetId() != null) {
            asset = assetRepository.findById(request.assetId())
                    .orElseThrow(() -> new IllegalArgumentException("Asset not found"));
        }

        BigDecimal fees =
                request.fees() == null ? BigDecimal.ZERO : request.fees();

        // Normalise to NUMERIC(19,4) precision before the duplicate check and
        // before persisting, so that 1.973266 (CSV) == 1.9733 (DB).
        BigDecimal quantity4 = request.quantity()    .setScale(4, java.math.RoundingMode.HALF_UP);
        BigDecimal price4    = request.pricePerUnit().setScale(4, java.math.RoundingMode.HALF_UP);
        BigDecimal fees4     = fees                  .setScale(4, java.math.RoundingMode.HALF_UP);

        if (asset != null &&
                transactionRepository
                        .existsByAccountIdAndAssetIdAndTransactionTypeAndQuantityAndPricePerUnitAndFeesAndTransactionDate(
                                account.getId(),
                                asset.getId(),
                                request.transactionType(),
                                quantity4,
                                price4,
                                fees4,
                                request.transactionDate()
                        )) {
            throw new IllegalArgumentException(
                    "Duplicate transaction already exists"
            );
        }

        Transaction transaction = new Transaction();
        transaction.setAccount(account);
        transaction.setAsset(asset);
        transaction.setTransactionType(request.transactionType());
        transaction.setQuantity(quantity4);
        transaction.setPricePerUnit(price4);
        transaction.setFees(fees4);
        transaction.setTransactionDate(request.transactionDate());
        transaction.setNotes(request.notes());

        Transaction savedTransaction = transactionRepository.save(transaction);
        taxLotService.processTransaction(savedTransaction);
        holdingService.updateHoldingFromTransaction(savedTransaction);
        Transaction updatedTransaction = transactionRepository.save(savedTransaction);
        return toResponse(updatedTransaction);
    }

    public List<TransactionResponse> getTransactionsByAccountId(UUID accountId) {
        return transactionRepository.findByAccountIdWithAssetAndAccount(accountId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public TransactionResponse toResponse(Transaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getAccount().getId(),
                transaction.getAsset() == null ? null : transaction.getAsset().getId(),
                transaction.getAsset() == null ? null : transaction.getAsset().getSymbol(),
                transaction.getAsset() == null ? null : transaction.getAsset().getName(),
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
