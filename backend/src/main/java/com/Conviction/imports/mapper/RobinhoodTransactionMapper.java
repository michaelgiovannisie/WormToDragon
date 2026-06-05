package com.conviction.imports.mapper;

import com.conviction.imports.dto.ImportedTransactionRow;
import com.conviction.imports.dto.RobinhoodCsvRow;
import com.conviction.transaction.enums.TransactionType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;

@Component
public class RobinhoodTransactionMapper {

    public ImportedTransactionRow map(RobinhoodCsvRow row) {
        String symbol = row.values().getOrDefault("Instrument", "").trim();
        String assetName = row.values().getOrDefault("Description", "").trim();
        TransactionType transactionType = mapTransactionType(row);

        BigDecimal quantity = new BigDecimal(
                row.values().getOrDefault("Quantity", "0").trim()
        );

        BigDecimal pricePerUnit = new BigDecimal(
                row.values().getOrDefault("Price", "0").trim()
        );

        LocalDate transactionDate = LocalDate.parse(
                row.values().getOrDefault("Activity Date", "").trim()
        );

        String notes = "Imported from Robinhood CSV";

        return new ImportedTransactionRow(
                symbol,
                assetName,
                transactionType,
                quantity,
                pricePerUnit,
                transactionDate,
                notes
        );
    }

    public TransactionType mapTransactionType(RobinhoodCsvRow row) {
        String code = row.values()
                .getOrDefault("Trans Code", "")
                .trim()
                .toUpperCase();

        return switch (code) {
            case "BUY" -> TransactionType.BUY;
            case "SELL" -> TransactionType.SELL;
            case "DIV", "DIVIDEND" -> TransactionType.DIVIDEND;
            default -> throw new IllegalArgumentException(
                    "Unsupported Robinhood transaction type: " + code
            );
        };
    }
}