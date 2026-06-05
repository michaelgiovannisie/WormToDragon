package com.conviction.imports.dto;

import java.util.UUID;

public record ImportPortfolioRequest(
        UUID portfolioId,
        UUID accountId
) {
}