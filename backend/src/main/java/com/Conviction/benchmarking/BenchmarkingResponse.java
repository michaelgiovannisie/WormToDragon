package com.conviction.benchmarking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record BenchmarkingResponse(
        LocalDate date,
        BigDecimal totalValue,
        List<HoldingSnapshot> holdings
) {
    public record HoldingSnapshot(
            String symbol,
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal value
    ) {}
}
