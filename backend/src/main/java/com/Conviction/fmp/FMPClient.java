package com.conviction.fmp;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@Component
public class FMPClient {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${fmp.api-key}")
    private String apiKey;

    @Value("${fmp.base-url}")
    private String baseUrl;

    public String url(String path, String... queryPairs) {
        StringBuilder sb = new StringBuilder(baseUrl).append(path)
                .append("?apikey=").append(apiKey);

        for (int i = 0; i + 1 < queryPairs.length; i += 2) {
            sb.append("&").append(queryPairs[i]).append("=")
              .append(URLEncoder.encode(queryPairs[i + 1], StandardCharsets.UTF_8));
        }

        return sb.toString();
    }

    public <T> T get(String path, Class<T> responseType, String... queryPairs) {
        String u = url(path, queryPairs);
        try {
            return restTemplate.getForObject(u, responseType);
        } catch (HttpClientErrorException e) {
            // 402 = premium endpoint, 404 = not found — treat as no data
            System.err.println("[FMP] HTTP " + e.getStatusCode() + " for " + u);
            System.err.println("[FMP] Body: " + e.getResponseBodyAsString());
            return null;
        } catch (Exception e) {
            System.err.println("[FMP] Error for " + u + " — " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return null;
        }
    }
}
