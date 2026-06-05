package com.conviction.portfolio.snapshot.service;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.conviction.holding.service.HoldingService;
import com.conviction.portfolio.dto.PortfolioSummaryResponse;
import com.conviction.portfolio.snapshot.PortfolioSnapshot;
import com.conviction.portfolio.snapshot.repository.PortfolioSnapshotRepository;

@Service
public class PortfolioSnapshotService {

    private final PortfolioSnapshotRepository snapshotRepository;
    private final HoldingService holdingService;

    public PortfolioSnapshotService(
            PortfolioSnapshotRepository snapshotRepository,
            HoldingService holdingService
    ) {
        this.snapshotRepository = snapshotRepository;
        this.holdingService = holdingService;
    }

    public PortfolioSnapshot createSnapshot(UUID portfolioId) {
        PortfolioSummaryResponse summary =
                holdingService.getPortfolioSummary(portfolioId);

        PortfolioSnapshot snapshot = new PortfolioSnapshot();

        snapshot.setPortfolioId(portfolioId);
        snapshot.setSnapshotDate(LocalDate.now());
        snapshot.setTotalMarketValue(summary.totalMarketValue());
        snapshot.setTotalCostBasis(summary.totalCostBasis());
        snapshot.setUnrealizedGain(summary.totalUnrealizedGain());
        snapshot.setRealizedGain(summary.totalRealizedGain());
        snapshot.setCashFlow(summary.netCashFlow());

        return snapshotRepository.save(snapshot);
    }
}