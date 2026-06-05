package com.conviction.imports.controller;

import com.conviction.imports.dto.ImportResultResponse;
import com.conviction.imports.service.RobinhoodImportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/imports")
public class ImportController {

    private final RobinhoodImportService importService;

    public ImportController(RobinhoodImportService importService) {
        this.importService = importService;
    }

    @PostMapping("/robinhood")
    public ResponseEntity<ImportResultResponse> importRobinhood(
            @RequestParam("portfolioId") UUID portfolioId,
            @RequestParam("accountId") UUID accountId,
            @RequestParam("file") MultipartFile file
    ) {
        ImportResultResponse response =
                importService.importCsv(portfolioId, accountId, file);

        return ResponseEntity.ok(response);
    }
}