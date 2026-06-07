package com.conviction.asset.dto;

import java.math.BigDecimal;
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
        LocalDateTime createdAt,

        // Equity
        String sector,
        String industry,
        BigDecimal marketCap,
        BigDecimal peRatio,
        BigDecimal eps,

        // ETF
        BigDecimal expenseRatio,
        String underlying,
        String fundFamily,

        // Crypto
        String network,
        String consensusType,
        BigDecimal circulatingSupply,
        Integer marketCapRank
) {
    public AssetResponse(UUID id, String symbol, String name, String assetType,
                         String exchange, String currency, Boolean active, LocalDateTime createdAt) {
        this(id, symbol, name, assetType, exchange, currency, active, createdAt,
             null, null, null, null, null,
             null, null, null,
             null, null, null, null);
    }
}
