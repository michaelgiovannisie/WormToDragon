package com.conviction.tax.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record TaxLotResponse(
        UUID id,
        UUID accountId,
        UUID assetId,
        String symbol,
        String assetName,
        UUID buyTransactionId,
        BigDecimal quantityPurchased,
        BigDecimal quantityRemaining,
        BigDecimal costBasisPerUnit,
        BigDecimal totalCostBasis,
        LocalDate acquisitionDate,
        Boolean closed,
        LocalDateTime createdAt
) {
}