package com.conviction.watchlist.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.watchlist.entity.WatchlistItem;

public interface WatchlistItemRepository extends JpaRepository<WatchlistItem, UUID> {

    Optional<WatchlistItem> findByWatchlistIdAndAssetSymbol(UUID watchlistId, String symbol);

    boolean existsByWatchlistIdAndAssetSymbol(UUID watchlistId, String symbol);
}
