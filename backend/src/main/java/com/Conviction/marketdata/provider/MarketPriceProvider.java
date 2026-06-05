package com.conviction.marketdata.provider;

import java.math.BigDecimal;

public interface MarketPriceProvider {

    BigDecimal getLatestPrice(String symbol);
}