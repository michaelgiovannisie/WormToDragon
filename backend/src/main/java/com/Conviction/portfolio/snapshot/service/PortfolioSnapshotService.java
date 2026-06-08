package com.conviction.portfolio.snapshot.service;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.conviction.holding.service.HoldingService;
import com.conviction.portfolio.dto.PortfolioSummaryResponse;
import com.conviction.portfolio.entity.Portfolio;
import com.conviction.portfolio.repository.PortfolioRepository;
import com.conviction.portfolio.snapshot.PortfolioSnapshot;
import com.conviction.portfolio.snapshot.repository.PortfolioSnapshotRepository;

@Service
public class PortfolioSnapshotService {

    private final PortfolioSnapshotRepository snapshotRepository;
    private final PortfolioRepository portfolioRepository;
    private final HoldingService holdingService;

    public PortfolioSnapshotService(
            PortfolioSnapshotRepository snapshotRepository,
            PortfolioRepository portfolioRepository,
            HoldingService holdingService
    ) {
        this.snapshotRepository = snapshotRepository;
        this.portfolioRepository = portfolioRepository;
        this.holdingService = holdingService;
    }

    public PortfolioSnapshot createSnapshot(UUID portfolioId) {
        return createOrUpdateTodaySnapshot(portfolioId);
    }

    public PortfolioSnapshot createOrUpdateTodaySnapshot(UUID portfolioId) {
        PortfolioSummaryResponse summary =
                holdingService.getPortfolioSummary(portfolioId);

        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));

        PortfolioSnapshot snapshot =
        snapshotRepository
                .findByPortfolio_IdAndSnapshotDateOrderByCreatedAtDesc(
                        portfolioId,
                        LocalDate.now()
                )
                .stream()
                .findFirst()
                .orElseGet(PortfolioSnapshot::new);

        snapshot.setPortfolio(portfolio);
        snapshot.setSnapshotDate(LocalDate.now());
        snapshot.setTotalMarketValue(summary.totalMarketValue());
        snapshot.setTotalCostBasis(summary.totalCostBasis());
        snapshot.setUnrealizedGain(summary.totalUnrealizedGain());
        snapshot.setRealizedGain(summary.totalRealizedGain());
        snapshot.setCashFlow(summary.netCashFlow());

        return snapshotRepository.save(snapshot);
    }
}