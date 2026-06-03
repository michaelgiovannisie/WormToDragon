package com.conviction.asset.dto;

public record CreateAssetRequest(
        String symbol,
        String name,
        String assetType,
        String exchange,
        String currency
) {
}