package com.conviction.imports.service;

import com.conviction.imports.dto.ImportPreviewResponse;
import com.conviction.imports.dto.RobinhoodCsvRow;
import com.conviction.imports.mapper.RobinhoodTransactionMapper;
import com.conviction.imports.dto.ImportedTransactionRow;
import com.conviction.imports.parser.RobinhoodCsvParser;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class RobinhoodImportService {

    private final RobinhoodCsvParser parser;
    private final RobinhoodTransactionMapper mapper;

    public RobinhoodImportService(
            RobinhoodCsvParser parser,
            RobinhoodTransactionMapper mapper
    ) {
        this.parser = parser;
        this.mapper = mapper;
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

        List<ImportedTransactionRow> importedRows = rows.stream()
                .map(mapper::map)
                .toList();

        return new ImportPreviewResponse(
                importedRows.size(),
                columns
        );
    }
}