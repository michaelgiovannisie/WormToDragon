package com.conviction.transaction.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;

import com.conviction.transaction.dto.CreateTransactionRequest;
import com.conviction.transaction.dto.TransactionResponse;
import com.conviction.transaction.enums.TransactionType;
import com.conviction.transaction.service.TransactionService;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping
    public TransactionResponse createTransaction(@RequestBody CreateTransactionRequest request) {
        return transactionService.createTransaction(request);
    }

    @GetMapping("/account/{accountId}")
    public List<TransactionResponse> getTransactionsByAccountId(
            @PathVariable UUID accountId,
            @RequestParam(required = false) TransactionType type,
            @RequestParam(required = false) String asset,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate
    ) {

        if (type != null && asset != null && !asset.isBlank()) {
            return transactionService.getTransactionsByAccountIdAndTypeAndAssetSymbol(
                    accountId,
                    type,
                    asset
            );
        }

        if (type != null) {
            return transactionService.getTransactionsByAccountIdAndType(accountId, type);
        }

        if (asset != null && !asset.isBlank()) {
            return transactionService.getTransactionsByAccountIdAndAssetSymbol(
                    accountId,
                    asset
            );
        }

        if (startDate != null && endDate != null) {
            return transactionService.getTransactionsByAccountIdAndDateRange(
                    accountId,
                    startDate,
                    endDate
            );
        }

        return transactionService.getTransactionsByAccountId(accountId);
    }
}