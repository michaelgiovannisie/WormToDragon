package com.conviction.imports.service;

import com.conviction.imports.dto.ImportPreviewResponse;
import com.conviction.imports.dto.RobinhoodCsvRow;
import com.conviction.imports.parser.RobinhoodCsvParser;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class RobinhoodImportService {

    private final RobinhoodCsvParser parser;

    public RobinhoodImportService(RobinhoodCsvParser parser) {
        this.parser = parser;
    }

    public ImportPreviewResponse importCsv(MultipartFile file) {
        List<RobinhoodCsvRow> rows = parser.parse(file);

        List<String> columns = rows.isEmpty()
                ? List.of()
                : rows.get(0)
                        .values()
                        .keySet()
                        .stream()
                        .toList();

        return new ImportPreviewResponse(
                rows.size(),
                columns
        );
    }
}