package com.conviction.account.dto;

import java.util.UUID;

public record CreateAccountRequest(
        UUID portfolioId,
        String accountName,
        String brokerName,
        String accountType,
        String maskedAccountNumber
) {
}