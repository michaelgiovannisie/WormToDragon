package com.conviction.valuation.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.dto.ValuationResponse;
import com.conviction.valuation.service.ValuationService;

@RestController
@RequestMapping("/api/valuations")
public class ValuationController {

    private final ValuationService valuationService;

    public ValuationController(ValuationService valuationService) {
        this.valuationService = valuationService;
    }

    @PostMapping
    public ValuationResponse calculateValuation(
            @RequestBody ValuationRequest request
    ) {
        return valuationService.calculateIntrinsicValue(request);
    }
}