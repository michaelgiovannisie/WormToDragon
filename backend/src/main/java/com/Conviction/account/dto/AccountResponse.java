package com.conviction.account.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AccountResponse(
        UUID id,
        String accountName,
        String brokerName,
        String accountType,
        String maskedAccountNumber,
        Boolean active,
        UUID portfolioId,
        LocalDateTime createdAt
) {
}