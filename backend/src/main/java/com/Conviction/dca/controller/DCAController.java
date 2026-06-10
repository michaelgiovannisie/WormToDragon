package com.conviction.dca.controller;

import java.math.BigDecimal;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.dca.dto.DCARecommendation;
import com.conviction.dca.service.DCAService;

@RestController
@RequestMapping("/api/dca")
public class DCAController {

    private final DCAService dcaService;

    public DCAController(DCAService dcaService) {
        this.dcaService = dcaService;
    }

    @GetMapping("/{symbol}/recommendation")
    public DCARecommendation getRecommendation(
            @PathVariable String symbol,
            @RequestParam(required = false) BigDecimal availableCash
    ) {
        return dcaService.getRecommendation(symbol.toUpperCase(), availableCash);
    }
}
