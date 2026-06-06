package com.conviction.valuation.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.valuation.dto.ValuationPresetRequest;
import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.dto.ValuationResponse;
import com.conviction.valuation.entity.ValuationScenario;
import com.conviction.valuation.service.ValuationService;

@RestController
@RequestMapping("/api/valuations")
public class ValuationController {

    private final ValuationService valuationService;

    public ValuationController(ValuationService valuationService) {
        this.valuationService = valuationService;
    }

    @GetMapping("/{symbol}/scenarios")
    public List<ValuationScenario> getScenarios(
            @PathVariable String symbol
    ) {
        return valuationService.getScenarios(symbol);
    }

    @PostMapping
    public ValuationResponse calculateValuation(
            @RequestBody ValuationRequest request
    ) {
        return valuationService.calculateIntrinsicValue(request);
    }

    @PostMapping("/presets")
    public List<ValuationResponse> calculatePresets(
            @RequestBody ValuationPresetRequest request
    ) {
        return valuationService.calculatePresets(request);
    }
}