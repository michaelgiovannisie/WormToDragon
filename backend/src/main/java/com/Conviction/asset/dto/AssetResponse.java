package com.conviction.asset.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AssetResponse(
        UUID id,
        String symbol,
        String name,
        String assetType,
        String exchange,
        String currency,
        Boolean active,
        LocalDateTime createdAt
) {
}