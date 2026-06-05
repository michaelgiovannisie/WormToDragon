package com.conviction.marketdata.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.marketdata.dto.UpdateMarketPriceRequest;
import com.conviction.marketdata.dto.UpdateMarketPriceResponse;
import com.conviction.marketdata.service.MarketDataService;

@RestController
@RequestMapping("/api/market-data")
public class MarketDataController {

    private final MarketDataService marketDataService;

    public MarketDataController(MarketDataService marketDataService) {
        this.marketDataService = marketDataService;
    }

    @PostMapping("/prices")
    public UpdateMarketPriceResponse updateMarketPrice(
            @RequestBody UpdateMarketPriceRequest request
    ) {
        return marketDataService.updateMarketPrice(request);
    }
}