package com.conviction.imports.dto;

import java.util.List;

public record ImportPreviewResponse(
        int rowCount,
        List<String> columns
) {
}