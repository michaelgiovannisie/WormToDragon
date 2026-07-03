package com.conviction.cryptovaluation.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.cryptovaluation.dto.CryptoValuationResponse;
import com.conviction.cryptovaluation.service.CryptoValuationService;

@RestController
@RequestMapping("/api/crypto-valuation")
public class CryptoValuationController {

    private final CryptoValuationService service;

    public CryptoValuationController(CryptoValuationService service) {
        this.service = service;
    }

    @GetMapping("/{symbol}")
    public CryptoValuationResponse get(
            @PathVariable String symbol,
            @RequestParam(required = false) Double blockReward) {
        return service.calculate(symbol, blockReward);
    }
}
