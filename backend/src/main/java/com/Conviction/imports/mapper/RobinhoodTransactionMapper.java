package com.conviction.imports.mapper;

import com.conviction.imports.dto.ImportedTransactionRow;
import com.conviction.imports.dto.RobinhoodCsvRow;
import com.conviction.transaction.enums.TransactionType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

@Component
public class RobinhoodTransactionMapper {

    private static final Set<String> SKIP_CODES = Set.of(
        "CDIV", "ACH", "INT", "DTAX", "AFEE", "DFEE", "RTP",
        "GOLD", "FUTSWP", "CIL", "MRGC", "MISC", "WIRE", "JNLC", "JNLS"
    );

    /** Returns null for rows that should be skipped (non-trade activity). */
    public ImportedTransactionRow map(RobinhoodCsvRow row) {
        String code = row.values().getOrDefault("Trans Code", "").trim().toUpperCase();
        if (code.isEmpty() || SKIP_CODES.contains(code)) return null;

        String symbol = row.values().getOrDefault("Instrument", "").trim();
        if (symbol.isEmpty()) return null;

        TransactionType transactionType = mapTransactionType(code);
        if (transactionType == null) return null;

        BigDecimal quantity = parseMoney(row.values().getOrDefault("Quantity", "0"));
        BigDecimal pricePerUnit = parseMoney(row.values().getOrDefault("Price", "0"));

        String dateStr = row.values().getOrDefault("Activity Date", "").trim();
        if (dateStr.isEmpty()) return null;
        LocalDate transactionDate = LocalDate.parse(dateStr);

        // First line of description only (strip CUSIP line)
        String rawDesc = row.values().getOrDefault("Description", symbol).trim();
        String assetName = rawDesc.contains("\n") ? rawDesc.substring(0, rawDesc.indexOf('\n')).trim() : rawDesc;

        return new ImportedTransactionRow(
                symbol,
                assetName,
                transactionType,
                quantity,
                pricePerUnit,
                transactionDate,
                "Imported from Robinhood CSV"
        );
    }

    private TransactionType mapTransactionType(String code) {
        return switch (code) {
            case "BUY" -> TransactionType.BUY;
            case "SELL" -> TransactionType.SELL;
            case "DIV", "DIVIDEND" -> TransactionType.DIVIDEND;
            default -> null;
        };
    }

    private BigDecimal parseMoney(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        // Strip $, commas, parentheses (negatives shown as "(123.45)")
        String cleaned = raw.trim()
                .replace("$", "")
                .replace(",", "")
                .replace("(", "-")
                .replace(")", "");
        try {
            return new BigDecimal(cleaned);
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}