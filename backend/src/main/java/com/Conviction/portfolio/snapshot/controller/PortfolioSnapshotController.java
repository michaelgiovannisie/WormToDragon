package com.conviction.portfolio.snapshot.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.portfolio.snapshot.PortfolioSnapshot;
import com.conviction.portfolio.snapshot.repository.PortfolioSnapshotRepository;
import com.conviction.portfolio.snapshot.service.PortfolioSnapshotService;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/snapshots")
public class PortfolioSnapshotController {

    private final PortfolioSnapshotService snapshotService;
    private final PortfolioSnapshotRepository snapshotRepository;

    public PortfolioSnapshotController(
            PortfolioSnapshotService snapshotService,
            PortfolioSnapshotRepository snapshotRepository
    ) {
        this.snapshotService = snapshotService;
        this.snapshotRepository = snapshotRepository;
    }

    @PostMapping
    public PortfolioSnapshot createSnapshot(
            @PathVariable UUID portfolioId
    ) {
        return snapshotService.createSnapshot(portfolioId);
    }

    @GetMapping
    public List<PortfolioSnapshot> getSnapshots(
            @PathVariable UUID portfolioId
    ) {
        return snapshotRepository
                .findByPortfolioIdOrderBySnapshotDateAsc(portfolioId);
    }
}