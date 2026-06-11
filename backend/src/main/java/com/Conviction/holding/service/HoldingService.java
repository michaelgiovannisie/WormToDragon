package com.conviction.holding.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.conviction.historicalprice.entity.HistoricalPrice;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.conviction.account.entity.Account;
import com.conviction.asset.entity.Asset;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;
import com.conviction.holding.dto.PortfolioHoldingResponse;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.portfolio.dto.CashFlowTimelineResponse;
import com.conviction.portfolio.dto.PortfolioPerformanceResponse;
import com.conviction.portfolio.dto.PortfolioSummaryResponse;
import com.conviction.tax.entity.TaxLotAllocation;
import com.conviction.tax.repository.TaxLotAllocationRepository;
import com.conviction.tax.repository.TaxLotRepository;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;
import com.conviction.transaction.repository.TransactionRepository;

@Service
public class HoldingService {

    private final HoldingRepository holdingRepository;
    private final TransactionRepository transactionRepository;
    private final TaxLotAllocationRepository allocationRepository;
    private final HistoricalPriceRepository historicalPriceRepository;
    private final TaxLotRepository taxLotRepository;

    public HoldingService(
                HoldingRepository holdingRepository,
                TransactionRepository transactionRepository,
                TaxLotAllocationRepository allocationRepository,
                HistoricalPriceRepository historicalPriceRepository,
                TaxLotRepository taxLotRepository
        ) {
            this.holdingRepository = holdingRepository;
            this.transactionRepository = transactionRepository;
            this.allocationRepository = allocationRepository;
            this.historicalPriceRepository = historicalPriceRepository;
            this.taxLotRepository = taxLotRepository;
        }

    /**
     * Resets the holding for the given symbol to zero and replays every stored
     * BUY/SELL/DIVIDEND transaction in chronological order. Fixes holdings that
     * became corrupted by duplicate imports caused by scale-4 precision mismatch.
     *
     * @return a diagnostic string describing the rebuilt state
     */
    @Transactional
    public String rebuildHoldingForSymbol(String symbol) {
        List<com.conviction.holding.entity.Holding> holdings =
                holdingRepository.findByAssetSymbol(symbol.toUpperCase());

        if (holdings.isEmpty()) {
            return "No holding found for " + symbol;
        }

        StringBuilder result = new StringBuilder();

        for (Holding h : holdings) {
            // Reset to clean state
            h.setQuantityHeld(BigDecimal.ZERO);
            h.setTotalCostBasis(BigDecimal.ZERO);
            h.setMarketPrice(BigDecimal.ZERO);
            h.setMarketValue(BigDecimal.ZERO);
            h.setUnrealizedGain(BigDecimal.ZERO);
            h.setActive(false);
            holdingRepository.save(h);

            // Replay all transactions in date order
            List<Transaction> txns =
                    transactionRepository.findByAccountIdAndAssetIdForReplay(
                            h.getAccount().getId(),
                            h.getAsset().getId()
                    );

            for (Transaction t : txns) {
                try {
                    updateHoldingFromTransaction(t);
                } catch (Exception e) {
                    result.append("  WARN skipped txn ")
                          .append(t.getId()).append(": ").append(e.getMessage()).append("\n");
                }
            }

            // Re-read to get final state after replay
            Holding rebuilt = holdingRepository.findById(h.getId()).orElse(h);

            result.append("Rebuilt ").append(symbol)
                  .append(" → qty=").append(rebuilt.getQuantityHeld())
                  .append(", costBasis=").append(rebuilt.getTotalCostBasis())
                  .append(", active=").append(rebuilt.getActive())
                  .append(", txns=").append(txns.size())
                  .append("\n");
        }

        return result.toString();
    }

    @Transactional
    public int refreshPricesForSymbol(String symbol) {
        return historicalPriceRepository
                .findTopByAssetSymbolOrderByPriceDateDesc(symbol)
                .map(latest -> {
                    BigDecimal price = latest.getClose();
                    List<com.conviction.holding.entity.Holding> holdings =
                            holdingRepository.findActiveByAssetSymbolWithAssetAndAccount(symbol);
                    for (com.conviction.holding.entity.Holding h : holdings) {
                        h.setMarketPrice(price);
                        h.setMarketValue(h.getQuantityHeld().multiply(price));
                        h.setUnrealizedGain(h.getMarketValue().subtract(h.getTotalCostBasis()));
                        holdingRepository.save(h);
                    }
                    return holdings.size();
                })
                .orElse(0);
    }

    public void updateHoldingFromTransaction(Transaction transaction) {
        if (transaction.getAsset() == null) {
            return;
        }

        if (transaction.getTransactionType() == TransactionType.BUY) {
            handleBuy(transaction);
        }

        if (transaction.getTransactionType() == TransactionType.SELL) {
            handleSell(transaction);
        }

        if (transaction.getTransactionType() == TransactionType.DIVIDEND) {
            handleDividend(transaction);
        }
    }

    private void handleBuy(Transaction transaction) {
        Account account = transaction.getAccount();
        Asset asset = transaction.getAsset();

        Holding holding = holdingRepository
                .findByAccountIdAndAssetId(account.getId(), asset.getId())
                .orElseGet(() -> createNewHolding(account, asset));

        BigDecimal transactionCost = transaction.getQuantity()
                .multiply(transaction.getPricePerUnit())
                .add(transaction.getFees());

        holding.setQuantityHeld(
                holding.getQuantityHeld().add(transaction.getQuantity())
        );

        holding.setTotalCostBasis(
                holding.getTotalCostBasis().add(transactionCost)
        );

        updateMarketAnalytics(holding, transaction.getPricePerUnit());

        holding.setActive(true);

        holdingRepository.save(holding);
    }

    private void handleSell(Transaction transaction) {
        Account account = transaction.getAccount();
        Asset asset = transaction.getAsset();

        Holding holding = holdingRepository
                .findByAccountIdAndAssetId(account.getId(), asset.getId())
                .orElseThrow(() -> new IllegalArgumentException("Holding not found"));

        BigDecimal newQuantity = holding.getQuantityHeld()
                .subtract(transaction.getQuantity());

        // For stock splits, pre-split buy quantities may be smaller than post-split sell
        // quantities. Clamp to zero rather than rejecting the transaction entirely.
        if (newQuantity.compareTo(BigDecimal.ZERO) < 0) {
            newQuantity = BigDecimal.ZERO;
        }

        BigDecimal averageCostBasis =
                holding.getQuantityHeld().compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : holding.getTotalCostBasis()
                        .divide(
                                holding.getQuantityHeld(),
                                4,
                                RoundingMode.HALF_UP
                        );

        List<TaxLotAllocation> allocations =
                allocationRepository.findBySellTransactionId(transaction.getId());

        BigDecimal costBasisReduction;

        if (allocations.isEmpty()) {
            costBasisReduction =
                    averageCostBasis.multiply(transaction.getQuantity());

            BigDecimal realizedGain =
                    transaction.getPricePerUnit()
                            .subtract(averageCostBasis)
                            .multiply(transaction.getQuantity());

            transaction.setRealizedGain(realizedGain);
        } else {
            costBasisReduction =
                    allocations.stream()
                            .map(TaxLotAllocation::getCostBasis)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal realizedGain =
                    allocations.stream()
                            .map(TaxLotAllocation::getRealizedGain)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

            transaction.setRealizedGain(realizedGain);
        }

        holding.setTotalCostBasis(
                holding.getTotalCostBasis().subtract(costBasisReduction)
        );

        holding.setQuantityHeld(newQuantity);

        if (newQuantity.compareTo(BigDecimal.ZERO) == 0) {
            holding.setActive(false);
        }

        updateMarketAnalytics(holding, transaction.getPricePerUnit());

        holdingRepository.save(holding);
    }

    private Holding createNewHolding(Account account, Asset asset) {
        Holding holding = new Holding();
        holding.setAccount(account);
        holding.setAsset(asset);
        holding.setQuantityHeld(BigDecimal.ZERO);
        holding.setTotalCostBasis(BigDecimal.ZERO);
        holding.setActive(true);
        return holding;
    }

    private void updateMarketAnalytics(Holding holding, BigDecimal marketPrice) {
        holding.setMarketPrice(marketPrice);

        BigDecimal marketValue = holding.getQuantityHeld().multiply(marketPrice);
        holding.setMarketValue(marketValue);

        BigDecimal unrealizedGain = marketValue.subtract(holding.getTotalCostBasis());
        holding.setUnrealizedGain(unrealizedGain);
    }

    public List<PortfolioHoldingResponse> getHoldingsByPortfolioId(UUID portfolioId) {
        List<Holding> holdings =
        holdingRepository.findActiveByPortfolioIdWithAssetAndAccount(portfolioId);

        // Refresh market prices from historical_price table before computing values
        holdings.stream()
                .map(h -> h.getAsset().getSymbol())
                .distinct()
                .forEach(this::refreshPricesForSymbol);

        // Re-fetch after refresh so we see updated marketValue
        holdings = holdingRepository.findActiveByPortfolioIdWithAssetAndAccount(portfolioId);

        Map<UUID, List<Holding>> holdingsByAsset = holdings.stream()
                .collect(Collectors.groupingBy(holding -> holding.getAsset().getId()));

        BigDecimal totalPortfolioValue = holdings.stream()
        .map(Holding::getMarketValue)
        .reduce(BigDecimal.ZERO, BigDecimal::add);

        return holdingsByAsset.values()
                .stream()
                .map(group -> toPortfolioHoldingResponse(group, totalPortfolioValue))
                .toList();
    }

    private PortfolioHoldingResponse toPortfolioHoldingResponse(
                List<Holding> holdings,
                BigDecimal totalPortfolioValue
        ){
        Holding first = holdings.get(0);

        BigDecimal totalQuantity = holdings.stream()
                .map(Holding::getQuantityHeld)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCostBasis = holdings.stream()
                .map(Holding::getTotalCostBasis)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal marketValue = holdings.stream()
                .map(Holding::getMarketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal unrealizedGain = marketValue.subtract(totalCostBasis);

        BigDecimal allocationPercent =
        totalPortfolioValue.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : marketValue
                .divide(totalPortfolioValue, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        BigDecimal averageCostBasis =
                totalQuantity.compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : totalCostBasis.divide(totalQuantity, 2, RoundingMode.HALF_UP);

        String symbol = first.getAsset().getSymbol();

        // Oldest open tax lot date — reflects current holding period, not all-time first buy
        LocalDate firstBuyDate = taxLotRepository.findOldestOpenLotDate(symbol).orElse(null);

        // Day change: today vs yesterday close
        List<HistoricalPrice> recentPrices = historicalPriceRepository
                .findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(
                        symbol, LocalDate.now().minusDays(5), LocalDate.now());
        BigDecimal dayChange = null;
        BigDecimal dayChangePct = null;
        if (recentPrices.size() >= 2) {
            BigDecimal today = recentPrices.get(recentPrices.size() - 1).getClose();
            BigDecimal prev  = recentPrices.get(recentPrices.size() - 2).getClose();
            dayChange = today.subtract(prev);
            if (prev.compareTo(BigDecimal.ZERO) != 0)
                dayChangePct = dayChange.divide(prev, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
        }

        // Sparkline: last 30 trading days of closes
        List<BigDecimal> sparkline = historicalPriceRepository
                .findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(
                        symbol, LocalDate.now().minusDays(45), LocalDate.now())
                .stream()
                .map(HistoricalPrice::getClose)
                .collect(Collectors.toList());
        if (sparkline.size() > 30) sparkline = sparkline.subList(sparkline.size() - 30, sparkline.size());

        return new PortfolioHoldingResponse(
                first.getAsset().getId(),
                symbol,
                first.getAsset().getName(),
                totalQuantity,
                totalCostBasis,
                averageCostBasis,
                first.getMarketPrice(),
                marketValue,
                unrealizedGain,
                allocationPercent,
                firstBuyDate,
                dayChange,
                dayChangePct,
                sparkline
        );
    }

    public PortfolioSummaryResponse getPortfolioSummary(UUID portfolioId) {

        List<PortfolioHoldingResponse> holdings =
                getHoldingsByPortfolioId(portfolioId);

        BigDecimal totalMarketValue = holdings.stream()
                .map(PortfolioHoldingResponse::marketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCostBasis = holdings.stream()
                .map(PortfolioHoldingResponse::totalCostBasis)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalUnrealizedGain =
                totalMarketValue.subtract(totalCostBasis);

        BigDecimal unrealizedGainPercent =
            totalCostBasis.compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : totalUnrealizedGain
                    .divide(totalCostBasis, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));

        BigDecimal totalDeposits = transactionRepository.findByAccountPortfolioId(portfolioId)
                .stream()
                .filter(transaction -> transaction.getTransactionType() == TransactionType.DEPOSIT)
                .map(transaction -> transaction.getQuantity().multiply(transaction.getPricePerUnit()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalWithdrawals = transactionRepository.findByAccountPortfolioId(portfolioId)
                .stream()
                .filter(transaction -> transaction.getTransactionType() == TransactionType.WITHDRAWAL)
                .map(transaction -> transaction.getQuantity().multiply(transaction.getPricePerUnit()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netCashFlow = totalDeposits.subtract(totalWithdrawals);

        BigDecimal totalDividends = transactionRepository.findByAccountPortfolioId(portfolioId)
                .stream()
                .filter(transaction -> transaction.getTransactionType() == TransactionType.DIVIDEND)
                .map(Transaction::getRealizedGain)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRealizedGain =
            transactionRepository
                    .findByAccountPortfolioId(portfolioId)
                    .stream()
                    .map(transaction ->
                            transaction.getRealizedGain() == null
                                    ? BigDecimal.ZERO
                                    : transaction.getRealizedGain()
                    )
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

        PortfolioHoldingResponse topHolding =
                holdings.stream()
                        .max((a, b) ->
                                a.allocationPercent()
                                        .compareTo(b.allocationPercent()))
                        .orElse(null);

        BigDecimal topAllocation =
        topHolding == null
                ? BigDecimal.ZERO
                : topHolding.allocationPercent();

        String concentrationRisk;

        if (topAllocation.compareTo(BigDecimal.valueOf(40)) > 0) {
            concentrationRisk = "HIGH";
        } else if (topAllocation.compareTo(BigDecimal.valueOf(20)) >= 0) {
            concentrationRisk = "MODERATE";
        } else {
            concentrationRisk = "DIVERSIFIED";
        }

        BigDecimal diversificationScore =
            BigDecimal.valueOf(100)
                    .subtract(topAllocation);

        BigDecimal rawHealthScore = diversificationScore;

        if (unrealizedGainPercent.compareTo(BigDecimal.ZERO) > 0) {
            rawHealthScore = rawHealthScore.add(BigDecimal.TEN);
        }

        if (concentrationRisk.equals("HIGH")) {
            rawHealthScore = rawHealthScore.subtract(BigDecimal.valueOf(20));
        } else if (concentrationRisk.equals("MODERATE")) {
            rawHealthScore = rawHealthScore.subtract(BigDecimal.TEN);
        }

        int portfolioHealthScore = rawHealthScore
                .max(BigDecimal.ZERO)
                .min(BigDecimal.valueOf(100))
                .intValue();

        String portfolioHealthLabel;

        if (portfolioHealthScore >= 80) {
            portfolioHealthLabel = "EXCELLENT";
        } else if (portfolioHealthScore >= 60) {
            portfolioHealthLabel = "GOOD";
        } else if (portfolioHealthScore >= 40) {
            portfolioHealthLabel = "FAIR";
        } else {
            portfolioHealthLabel = "WEAK";
        }

        return new PortfolioSummaryResponse(
                portfolioId,
                totalMarketValue,
                totalCostBasis,
                totalUnrealizedGain,
                unrealizedGainPercent,
                totalDeposits,
                totalWithdrawals,
                netCashFlow,
                totalDividends,
                totalRealizedGain,
                holdings.size(),
                topHolding == null ? null : topHolding.symbol(),
                topAllocation,
                concentrationRisk,
                diversificationScore,
                portfolioHealthScore,
                portfolioHealthLabel
        );
    }

    public List<PortfolioPerformanceResponse> getPortfolioPerformance(
            UUID portfolioId
    ) {

        List<Transaction> transactions =
                transactionRepository.findByAccountPortfolioId(portfolioId);

        Map<YearMonth, BigDecimal> monthlyValues =
                transactions.stream()
                        .collect(Collectors.groupingBy(
                                transaction ->
                                        YearMonth.from(
                                                transaction.getTransactionDate()
                                        ),
                                Collectors.mapping(
                                        transaction ->
                                                transaction.getQuantity()
                                                        .multiply(
                                                                transaction.getPricePerUnit()
                                                        ),
                                        Collectors.reducing(
                                                BigDecimal.ZERO,
                                                BigDecimal::add
                                        )
                                )
                        ));

        return monthlyValues.entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new PortfolioPerformanceResponse(
                        entry.getKey().toString(),
                        entry.getValue()
                ))
                .toList();
    }

    public List<CashFlowTimelineResponse> getCashFlowTimeline(UUID portfolioId) {

        List<Transaction> transactions =
                transactionRepository.findByAccountPortfolioId(portfolioId);

        Map<YearMonth, BigDecimal> monthlyCashFlows =
                transactions.stream()
                        .collect(Collectors.groupingBy(
                                transaction -> YearMonth.from(transaction.getTransactionDate()),
                                Collectors.mapping(
                                        transaction -> transaction.getQuantity()
                                                .multiply(transaction.getPricePerUnit()),
                                        Collectors.reducing(BigDecimal.ZERO, BigDecimal::add)
                                )
                        ));

        return monthlyCashFlows.entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new CashFlowTimelineResponse(
                        entry.getKey().toString(),
                        entry.getValue()
                ))
                .toList();
    }

    private void handleDividend(Transaction transaction) {

        Account account = transaction.getAccount();
        Asset asset = transaction.getAsset();

        Holding holding = holdingRepository
                .findByAccountIdAndAssetId(
                        account.getId(),
                        asset.getId()
                )
                .orElseThrow(() ->
                        new IllegalArgumentException("Holding not found"));

        BigDecimal dividendIncome =
                transaction.getQuantity()
                        .multiply(transaction.getPricePerUnit());

        transaction.setRealizedGain(dividendIncome);
    }
}
