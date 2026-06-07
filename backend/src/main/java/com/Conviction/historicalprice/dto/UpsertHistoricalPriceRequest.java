package com.conviction.historicalprice.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UpsertHistoricalPriceRequest(
        LocalDate priceDate,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        BigDecimal adjustedClose,
        Long volume
) {}
