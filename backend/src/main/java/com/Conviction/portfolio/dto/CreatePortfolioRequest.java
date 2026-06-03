package com.conviction.portfolio.dto;

import java.util.UUID;

public record CreatePortfolioRequest(
        UUID userId,
        String name,
        String description,
        String benchmark,
        String taxStrategy
) {
}