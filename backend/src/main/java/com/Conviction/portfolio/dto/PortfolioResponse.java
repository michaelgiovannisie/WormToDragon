package com.conviction.portfolio.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record PortfolioResponse(
        UUID id,
        String name,
        String description,
        String benchmark,
        String taxStrategy,
        Boolean active,
        UUID userId,
        LocalDateTime createdAt
) {
}