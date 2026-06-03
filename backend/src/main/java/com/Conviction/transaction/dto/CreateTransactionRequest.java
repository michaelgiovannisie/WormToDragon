package com.conviction.transaction.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.conviction.transaction.enums.TransactionType;

public record CreateTransactionRequest(
        UUID accountId,
        UUID assetId,
        TransactionType transactionType,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal fees,
        LocalDate transactionDate,
        String notes
) {
}