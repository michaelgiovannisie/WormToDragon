package com.conviction.marketdata.provider;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Primary
@Component
public class YahooFinanceMarketPriceProvider implements MarketPriceProvider {

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public BigDecimal getLatestPrice(String symbol) {
        String url =
                "https://query1.finance.yahoo.com/v8/finance/chart/"
                        + symbol;

        Map response = restTemplate.getForObject(url, Map.class);

        Map chart = (Map) response.get("chart");
        Object resultObject = ((java.util.List<?>) chart.get("result")).get(0);
        Map result = (Map) resultObject;
        Map meta = (Map) result.get("meta");

        Object price = meta.get("regularMarketPrice");

        return new BigDecimal(price.toString());
    }
}