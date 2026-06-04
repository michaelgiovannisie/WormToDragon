package com.conviction.portfolio.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PortfolioSummaryResponse(
        UUID portfolioId,
        BigDecimal totalMarketValue,
        BigDecimal totalCostBasis,
        BigDecimal totalUnrealizedGain,
        BigDecimal unrealizedGainPercent,
        BigDecimal totalDeposits,
        BigDecimal totalWithdrawals,
        BigDecimal netCashFlow,
        BigDecimal totalDividends,
        int numberOfHoldings,
        String topHoldingSymbol,
        BigDecimal topHoldingAllocation,
        String concentrationRisk,
        BigDecimal diversificationScore
) {
}