package com.conviction.historicalprice.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.historicalprice.dto.HistoricalPriceResponse;
import com.conviction.historicalprice.dto.UpsertHistoricalPriceRequest;
import com.conviction.historicalprice.service.HistoricalPriceService;

@RestController
@RequestMapping("/api/historical-prices")
public class HistoricalPriceController {

    private final HistoricalPriceService service;

    public HistoricalPriceController(HistoricalPriceService service) {
        this.service = service;
    }

    @GetMapping("/{symbol}")
    public List<HistoricalPriceResponse> getPrices(
            @PathVariable String symbol,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        String sym = symbol.toUpperCase();
        if (from != null && to != null) {
            return service.getPricesInRange(sym, from, to);
        }
        return service.getPrices(sym);
    }

    @GetMapping("/{symbol}/latest")
    public HistoricalPriceResponse getLatest(@PathVariable String symbol) {
        return service.getLatestPrice(symbol.toUpperCase());
    }

    @PostMapping("/{symbol}")
    public HistoricalPriceResponse upsert(
            @PathVariable String symbol,
            @RequestBody UpsertHistoricalPriceRequest request
    ) {
        return service.upsert(symbol, request);
    }

    @PostMapping("/{symbol}/batch")
    public List<HistoricalPriceResponse> upsertBatch(
            @PathVariable String symbol,
            @RequestBody List<UpsertHistoricalPriceRequest> requests
    ) {
        return service.upsertBatch(symbol, requests);
    }
}
