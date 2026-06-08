package com.conviction.portfolio.snapshot.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.portfolio.snapshot.PortfolioSnapshot;

public interface PortfolioSnapshotRepository
        extends JpaRepository<PortfolioSnapshot, UUID> {

    List<PortfolioSnapshot> findByPortfolio_IdOrderBySnapshotDateAsc(UUID portfolioId);

    List<PortfolioSnapshot> findByPortfolio_IdAndSnapshotDateOrderByCreatedAtDesc(
            UUID portfolioId,
            LocalDate snapshotDate
    );
}