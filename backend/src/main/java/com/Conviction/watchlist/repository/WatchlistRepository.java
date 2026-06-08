package com.conviction.watchlist.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.watchlist.entity.Watchlist;

public interface WatchlistRepository extends JpaRepository<Watchlist, UUID> {

    List<Watchlist> findByPortfolioIdOrderByCreatedAtDesc(UUID portfolioId);
}
