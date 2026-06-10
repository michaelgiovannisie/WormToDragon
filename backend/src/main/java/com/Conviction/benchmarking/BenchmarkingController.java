package com.conviction.benchmarking;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portfolio/{portfolioId}/benchmarking")
public class BenchmarkingController {

    private final BenchmarkingService service;

    public BenchmarkingController(BenchmarkingService service) {
        this.service = service;
    }

    @GetMapping("/value")
    public BenchmarkingResponse getValue(
            @PathVariable UUID portfolioId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return service.getPortfolioValue(portfolioId, date);
    }
}
