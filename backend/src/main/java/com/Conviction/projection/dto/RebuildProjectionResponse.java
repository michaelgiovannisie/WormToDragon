package com.conviction.projection.dto;

import java.util.UUID;

public record RebuildProjectionResponse(
        UUID accountId,
        UUID assetId,
        String symbol,
        int transactionsReplayed,
        String status
) {
}
