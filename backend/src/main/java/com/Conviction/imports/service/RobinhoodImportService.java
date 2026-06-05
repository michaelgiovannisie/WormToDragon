package com.conviction.imports.service;

import com.conviction.account.entity.Account;
import com.conviction.account.repository.AccountRepository;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.imports.dto.ImportPreviewResponse;
import com.conviction.imports.dto.ImportedTransactionRow;
import com.conviction.imports.dto.RobinhoodCsvRow;
import com.conviction.imports.mapper.RobinhoodTransactionMapper;
import com.conviction.imports.parser.RobinhoodCsvParser;
import com.conviction.transaction.dto.CreateTransactionRequest;
import com.conviction.transaction.service.TransactionService;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class RobinhoodImportService {

    private final RobinhoodCsvParser parser;
    private final RobinhoodTransactionMapper mapper;
    private final AccountRepository accountRepository;
    private final AssetRepository assetRepository;
    private final TransactionService transactionService;

    public RobinhoodImportService(
            RobinhoodCsvParser parser,
            RobinhoodTransactionMapper mapper,
            AccountRepository accountRepository,
            AssetRepository assetRepository,
            TransactionService transactionService
    ) {
        this.parser = parser;
        this.mapper = mapper;
        this.accountRepository = accountRepository;
        this.assetRepository = assetRepository;
        this.transactionService = transactionService;
    }

    public ImportPreviewResponse importCsv(
            UUID portfolioId,
            UUID accountId,
            MultipartFile file
    ) {
        List<RobinhoodCsvRow> rows = parser.parse(file);

        List<String> columns = rows.isEmpty()
                ? List.of()
                : rows.get(0).values().keySet().stream().toList();

        List<ImportedTransactionRow> importedRows = rows.stream()
                .map(mapper::map)
                .toList();

        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        for (ImportedTransactionRow row : importedRows) {
            Asset asset = assetRepository.findBySymbol(row.symbol())
                    .orElseGet(() -> {
                        Asset newAsset = new Asset();
                        newAsset.setSymbol(row.symbol());
                        newAsset.setName(row.assetName());
                        newAsset.setAssetType("EQUITY");
                        newAsset.setExchange("UNKNOWN");
                        newAsset.setCurrency("USD");
                        return assetRepository.save(newAsset);
                    });

            CreateTransactionRequest request = new CreateTransactionRequest(
                    account.getId(),
                    asset.getId(),
                    row.transactionType(),
                    row.quantity(),
                    row.pricePerUnit(),
                    BigDecimal.ZERO,
                    row.transactionDate(),
                    row.notes()
            );

            transactionService.createTransaction(request);
        }

        return new ImportPreviewResponse(importedRows.size(), columns);
    }
}