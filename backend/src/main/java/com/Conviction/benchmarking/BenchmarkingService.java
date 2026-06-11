package com.conviction.benchmarking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.conviction.historicalprice.repository.HistoricalPriceRepository;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;
import com.conviction.transaction.repository.TransactionRepository;

@Service
public class BenchmarkingService {

    private final TransactionRepository transactionRepository;
    private final HistoricalPriceRepository historicalPriceRepository;

    public BenchmarkingService(
            TransactionRepository transactionRepository,
            HistoricalPriceRepository historicalPriceRepository
    ) {
        this.transactionRepository = transactionRepository;
        this.historicalPriceRepository = historicalPriceRepository;
    }

    public BenchmarkingResponse getPortfolioValue(UUID portfolioId, LocalDate date) {
        List<Transaction> allTransactions = transactionRepository.findByAccountPortfolioId(portfolioId);

        // Replay transactions up to date
        Map<String, BigDecimal> quantities = new HashMap<>();
        for (Transaction t : allTransactions) {
            if (t.getAsset() == null) continue;
            if (t.getTransactionDate().isAfter(date)) continue;

            String symbol = t.getAsset().getSymbol();
            BigDecimal current = quantities.getOrDefault(symbol, BigDecimal.ZERO);

            if (t.getTransactionType() == TransactionType.BUY) {
                quantities.put(symbol, current.add(t.getQuantity()));
            } else if (t.getTransactionType() == TransactionType.SELL) {
                BigDecimal afterSell = current.subtract(t.getQuantity());
                // Clamp to zero — handles pre/post stock-split quantity mismatches
                quantities.put(symbol, afterSell.max(BigDecimal.ZERO));
            }
        }

        List<BenchmarkingResponse.HoldingSnapshot> snapshots = new ArrayList<>();
        BigDecimal totalValue = BigDecimal.ZERO;

        for (Map.Entry<String, BigDecimal> entry : quantities.entrySet()) {
            String symbol = entry.getKey();
            BigDecimal qty = entry.getValue();

            if (qty.compareTo(BigDecimal.ZERO) <= 0) continue;

            var priceOpt = historicalPriceRepository
                    .findTopByAssetSymbolAndPriceDateLessThanEqualOrderByPriceDateDesc(symbol, date);

            if (priceOpt.isEmpty()) continue;

            BigDecimal price = priceOpt.get().getClose();
            BigDecimal value = price.multiply(qty).setScale(4, RoundingMode.HALF_UP);
            totalValue = totalValue.add(value);
            snapshots.add(new BenchmarkingResponse.HoldingSnapshot(symbol, qty, price, value));
        }

        return new BenchmarkingResponse(date, totalValue, snapshots);
    }
}
