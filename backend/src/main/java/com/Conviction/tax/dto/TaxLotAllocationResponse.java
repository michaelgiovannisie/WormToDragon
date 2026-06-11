package com.conviction.tax.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record TaxLotAllocationResponse(
        UUID id,
        UUID sellTransactionId,
        UUID taxLotId,
        UUID buyTransactionId,
        BigDecimal quantityAllocated,
        BigDecimal proceeds,
        BigDecimal costBasis,
        BigDecimal realizedGain,
        LocalDate sellDate,       // actual sell transaction date
        LocalDateTime createdAt
) {
}