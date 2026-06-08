package com.conviction.portfolio.controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.historicalprice.entity.HistoricalPrice;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.portfolio.entity.Portfolio;
import com.conviction.portfolio.repository.PortfolioRepository;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/value-history")
public class PortfolioValueHistoryController {

    private final PortfolioRepository portfolioRepository;
    private final HoldingRepository holdingRepository;
    private final HistoricalPriceRepository priceRepository;

    public PortfolioValueHistoryController(
            PortfolioRepository portfolioRepository,
            HoldingRepository holdingRepository,
            HistoricalPriceRepository priceRepository
    ) {
        this.portfolioRepository = portfolioRepository;
        this.holdingRepository = holdingRepository;
        this.priceRepository = priceRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getValueHistory(
            @PathVariable UUID portfolioId,
            @RequestParam(defaultValue = "1y") String range
    ) {
        LocalDate now = LocalDate.now();
        LocalDate from = switch (range) {
            case "1d"  -> now.minusDays(1);
            case "1w"  -> now.minusWeeks(1);
            case "1m"  -> now.minusMonths(1);
            case "3m"  -> now.minusMonths(3);
            case "6m"  -> now.minusMonths(6);
            case "ytd" -> now.withDayOfYear(1);
            case "all" -> LocalDate.of(2000, 1, 1);
            default    -> now.minusYears(1);
        };

        // Get active holdings with their quantities
        List<Holding> holdings = holdingRepository
                .findActiveByPortfolioIdWithAssetAndAccount(portfolioId);

        if (holdings.isEmpty()) return List.of();

        // Build map: symbol -> quantity
        Map<String, BigDecimal> quantities = new HashMap<>();
        for (Holding h : holdings) {
            quantities.merge(h.getAsset().getSymbol(), h.getQuantityHeld(), BigDecimal::add);
        }

        // Collect all historical prices per symbol in range
        Map<String, Map<LocalDate, BigDecimal>> pricesBySymbol = new HashMap<>();
        for (String symbol : quantities.keySet()) {
            Map<LocalDate, BigDecimal> prices = new HashMap<>();
            priceRepository
                    .findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(symbol, from, LocalDate.now())
                    .forEach(hp -> prices.put(hp.getPriceDate(), hp.getClose()));
            if (!prices.isEmpty()) pricesBySymbol.put(symbol, prices);
        }

        if (pricesBySymbol.isEmpty()) return List.of();

        // Find all dates that appear across any symbol's price history
        TreeMap<LocalDate, BigDecimal> portfolioValues = new TreeMap<>();
        pricesBySymbol.values().stream()
                .flatMap(m -> m.keySet().stream())
                .distinct()
                .sorted()
                .forEach(date -> {
                    BigDecimal total = BigDecimal.ZERO;
                    for (Map.Entry<String, BigDecimal> e : quantities.entrySet()) {
                        String symbol = e.getKey();
                        BigDecimal qty = e.getValue();
                        Map<LocalDate, BigDecimal> prices = pricesBySymbol.get(symbol);
                        if (prices == null) continue;
                        // Use this date's price if available, otherwise skip this symbol for this date
                        BigDecimal price = prices.get(date);
                        if (price != null) total = total.add(qty.multiply(price));
                    }
                    if (total.compareTo(BigDecimal.ZERO) > 0) portfolioValues.put(date, total);
                });

        List<Map<String, Object>> result = new ArrayList<>();
        portfolioValues.forEach((date, value) -> {
            Map<String, Object> point = new HashMap<>();
            point.put("date", date.toString());
            point.put("value", value);
            result.add(point);
        });
        return result;
    }
}
