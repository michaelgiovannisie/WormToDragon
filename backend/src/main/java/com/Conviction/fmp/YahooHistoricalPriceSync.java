package com.conviction.fmp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.conviction.historicalprice.dto.HistoricalPriceResponse;
import com.conviction.historicalprice.dto.UpsertHistoricalPriceRequest;
import com.conviction.historicalprice.service.HistoricalPriceService;

@Service
public class YahooHistoricalPriceSync {

    private final RestTemplate restTemplate = new RestTemplate();
    private final HistoricalPriceService historicalPriceService;

    public YahooHistoricalPriceSync(HistoricalPriceService historicalPriceService) {
        this.historicalPriceService = historicalPriceService;
    }

    @SuppressWarnings("unchecked")
    public List<HistoricalPriceResponse> syncFull(String symbol) {
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/"
                + symbol + "?range=2y&interval=1d";

        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "Mozilla/5.0");
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            Map<String, Object> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, Map.class).getBody();

            if (response == null) return List.of();

            Map<String, Object> chart = (Map<String, Object>) response.get("chart");
            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return List.of();

            Map<String, Object> result = results.get(0);
            List<Number> timestamps = (List<Number>) result.get("timestamp");
            Map<String, Object> indicators = (Map<String, Object>) result.get("indicators");
            List<Map<String, Object>> quotes = (List<Map<String, Object>>) indicators.get("quote");
            Map<String, Object> quote = quotes.get(0);

            List<Number> opens   = (List<Number>) quote.get("open");
            List<Number> highs   = (List<Number>) quote.get("high");
            List<Number> lows    = (List<Number>) quote.get("low");
            List<Number> closes  = (List<Number>) quote.get("close");
            List<Number> volumes = (List<Number>) quote.get("volume");

            List<UpsertHistoricalPriceRequest> requests = java.util.stream.IntStream
                    .range(0, timestamps.size())
                    .filter(i -> closes.get(i) != null)
                    .mapToObj(i -> new UpsertHistoricalPriceRequest(
                            Instant.ofEpochSecond(timestamps.get(i).longValue()).atZone(ZoneOffset.UTC).toLocalDate(),
                            toBD(opens.get(i)),
                            toBD(highs.get(i)),
                            toBD(lows.get(i)),
                            toBD(closes.get(i)),
                            toBD(closes.get(i)),
                            volumes != null && volumes.get(i) != null ? volumes.get(i).longValue() : 0L
                    ))
                    .toList();

            return historicalPriceService.upsertBatch(symbol, requests);

        } catch (Exception e) {
            return List.of();
        }
    }

    private BigDecimal toBD(Number val) {
        if (val == null) return null;
        return BigDecimal.valueOf(val.doubleValue());
    }
}
