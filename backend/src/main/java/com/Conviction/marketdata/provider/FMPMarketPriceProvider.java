package com.conviction.marketdata.provider;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import com.conviction.fmp.FMPClient;

@Primary
@Component
public class FMPMarketPriceProvider implements MarketPriceProvider {

    private final FMPClient fmp;

    public FMPMarketPriceProvider(FMPClient fmp) {
        this.fmp = fmp;
    }

    @Override
    @SuppressWarnings("unchecked")
    public BigDecimal getLatestPrice(String symbol) {
        try {
            List<Map<String, Object>> result = fmp.get(
                    "/quote", List.class, "symbol", symbol);

            if (result == null || result.isEmpty()) {
                throw new IllegalStateException("No quote returned for: " + symbol);
            }

            Object price = result.get(0).get("price");
            return new BigDecimal(price.toString());

        } catch (Exception e) {
            throw new IllegalStateException(
                    "FMP price fetch failed for " + symbol + ": " + e.getMessage(), e);
        }
    }
}
