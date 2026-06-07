package com.conviction.asset.dto;

import java.math.BigDecimal;

public record CreateAssetRequest(
        // common
        String symbol,
        String name,
        String assetType,
        String exchange,
        String currency,

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
    public CreateAssetRequest(String symbol, String name, String assetType, String exchange, String currency) {
        this(symbol, name, assetType, exchange, currency,
             null, null, null, null, null,
             null, null, null,
             null, null, null, null);
    }
}
