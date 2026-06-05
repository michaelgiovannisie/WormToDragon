package com.conviction.imports.dto;

import java.util.Map;

public record RobinhoodCsvRow(
        Map<String, String> values
) {
}