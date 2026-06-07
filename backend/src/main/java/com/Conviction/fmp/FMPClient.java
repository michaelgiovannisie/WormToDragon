package com.conviction.fmp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
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
            sb.append("&").append(queryPairs[i]).append("=").append(queryPairs[i + 1]);
        }

        return sb.toString();
    }

    public <T> T get(String path, Class<T> responseType, String... queryPairs) {
        return restTemplate.getForObject(url(path, queryPairs), responseType);
    }
}
