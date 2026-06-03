package com.conviction.transaction.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.conviction.transaction.enums.TransactionType;

public record TransactionResponse(
        UUID id,
        UUID accountId,
        UUID assetId,
        TransactionType transactionType,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal fees,
        LocalDate transactionDate,
        String notes,
        LocalDateTime createdAt
) {
}