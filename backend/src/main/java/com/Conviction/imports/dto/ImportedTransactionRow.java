package com.conviction.imports.dto;

import com.conviction.transaction.enums.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ImportedTransactionRow(
        String symbol,
        String assetName,
        TransactionType transactionType,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        LocalDate transactionDate,
        String notes
) {
}