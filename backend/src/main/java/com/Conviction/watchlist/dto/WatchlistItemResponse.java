package com.conviction.watchlist.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record WatchlistItemResponse(
        UUID id,
        String symbol,
        String name,
        String assetType,
        String exchange,
        BigDecimal price,
        BigDecimal dayChange,
        BigDecimal dayChangePct,
        List<BigDecimal> sparkline,
        LocalDateTime addedAt
) {}
