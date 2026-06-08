package com.conviction.watchlist.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record WatchlistResponse(
        UUID id,
        String name,
        UUID portfolioId,
        int itemCount,
        LocalDateTime createdAt,
        List<WatchlistItemResponse> items
) {}
