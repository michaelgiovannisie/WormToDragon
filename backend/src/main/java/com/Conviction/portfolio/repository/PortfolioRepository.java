package com.conviction.portfolio.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.portfolio.entity.Portfolio;

public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

    List<Portfolio> findByUserId(UUID userId);

    List<Portfolio> findByUserIdAndActiveTrue(UUID userId);
}