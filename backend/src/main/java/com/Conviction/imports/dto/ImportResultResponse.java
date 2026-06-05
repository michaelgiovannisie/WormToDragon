package com.conviction.imports.dto;

import java.util.List;

public record ImportResultResponse(
        int rowsParsed,
        int transactionsImported,
        int assetsCreated,
        int transactionsSkipped,
        List<String> columns
) {
}