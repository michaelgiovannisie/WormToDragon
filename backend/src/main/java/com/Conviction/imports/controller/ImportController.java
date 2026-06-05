package com.conviction.imports.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.conviction.imports.service.RobinhoodImportService;

@RestController
@RequestMapping("/api/imports")
public class ImportController {

    private final RobinhoodImportService importService;

    public ImportController(
            RobinhoodImportService importService
    ) {
        this.importService = importService;
    }

    @PostMapping("/robinhood")
    public ResponseEntity<String> importRobinhood(
            @RequestParam("file")
            MultipartFile file
    ) {

        importService.importCsv(file);

        return ResponseEntity.ok(
                "Robinhood CSV imported successfully"
        );
    }
}