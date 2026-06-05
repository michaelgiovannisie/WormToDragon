package com.conviction.marketdata.provider;

import java.math.BigDecimal;

import org.springframework.stereotype.Component;

import com.conviction.asset.repository.AssetRepository;

@Component
public class ManualMarketPriceProvider implements MarketPriceProvider {

    private final AssetRepository assetRepository;

    public ManualMarketPriceProvider(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    @Override
    public BigDecimal getLatestPrice(String symbol) {
        return BigDecimal.ZERO;
    }
}