package com.conviction.imports.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.conviction.account.entity.Account;
import com.conviction.account.repository.AccountRepository;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.entity.Equity;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.imports.dto.ImportResultResponse;
import com.conviction.imports.dto.ImportedTransactionRow;
import com.conviction.imports.dto.RobinhoodCsvRow;
import com.conviction.imports.mapper.RobinhoodTransactionMapper;
import com.conviction.imports.parser.RobinhoodCsvParser;
import com.conviction.transaction.dto.CreateTransactionRequest;
import com.conviction.transaction.repository.TransactionRepository;
import com.conviction.transaction.service.TransactionService;

@Service
public class RobinhoodImportService {

    private final RobinhoodCsvParser parser;
    private final RobinhoodTransactionMapper mapper;
    private final AccountRepository accountRepository;
    private final AssetRepository assetRepository;
    private final TransactionService transactionService;
    private final TransactionRepository transactionRepository;

    public RobinhoodImportService(
                RobinhoodCsvParser parser,
                RobinhoodTransactionMapper mapper,
                AccountRepository accountRepository,
                AssetRepository assetRepository,
                TransactionService transactionService,
                TransactionRepository transactionRepository
        ) {
        this.parser = parser;
        this.mapper = mapper;
        this.accountRepository = accountRepository;
        this.assetRepository = assetRepository;
        this.transactionService = transactionService;
        this.transactionRepository = transactionRepository;
        }

        public ImportResultResponse importCsv(
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

        int assetsCreated = 0;
        int transactionsImported = 0;
        int transactionsSkipped = 0;

        for (ImportedTransactionRow row : importedRows) {
            Asset asset = assetRepository.findBySymbol(row.symbol())
                        .orElse(null);

                if (asset == null) {
                Equity newAsset = new Equity();
                newAsset.setSymbol(row.symbol());
                newAsset.setName(row.assetName());
                newAsset.setExchange("UNKNOWN");
                newAsset.setCurrency("USD");

                asset = assetRepository.save(newAsset);
                assetsCreated++;
        }

        boolean duplicate =
                transactionRepository.existsByAccountIdAndAssetIdAndTransactionTypeAndQuantityAndPricePerUnitAndFeesAndTransactionDate(
                        account.getId(),
                        asset.getId(),
                        row.transactionType(),
                        row.quantity(),
                        row.pricePerUnit(),
                        BigDecimal.ZERO,
                        row.transactionDate()
                );

        if (duplicate) {
        transactionsSkipped++;
        continue;
        }

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
            transactionsImported++;
        }

        return new ImportResultResponse(
                importedRows.size(),
                transactionsImported,
                assetsCreated,
                transactionsSkipped,
                columns
        );
    }
}