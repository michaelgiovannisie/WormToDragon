package com.conviction.holding.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.conviction.account.entity.Account;
import com.conviction.asset.entity.Asset;
import com.conviction.holding.dto.PortfolioHoldingResponse;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.transaction.entity.Transaction;
import com.conviction.transaction.enums.TransactionType;

@Service
public class HoldingService {

    private final HoldingRepository holdingRepository;

    public HoldingService(HoldingRepository holdingRepository) {
        this.holdingRepository = holdingRepository;
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

        if (newQuantity.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Cannot sell more than current holding");
        }

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
        List<Holding> holdings = holdingRepository.findAll()
                .stream()
                .filter(holding -> holding.getAccount()
                        .getPortfolio()
                        .getId()
                        .equals(portfolioId))
                .filter(Holding::getActive)
                .toList();

        Map<UUID, List<Holding>> holdingsByAsset = holdings.stream()
                .collect(Collectors.groupingBy(holding -> holding.getAsset().getId()));

        return holdingsByAsset.values()
                .stream()
                .map(this::toPortfolioHoldingResponse)
                .toList();
    }

    private PortfolioHoldingResponse toPortfolioHoldingResponse(List<Holding> holdings) {
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

        BigDecimal averageCostBasis =
                totalQuantity.compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : totalCostBasis.divide(totalQuantity, 2, RoundingMode.HALF_UP);

        return new PortfolioHoldingResponse(
                first.getAsset().getId(),
                first.getAsset().getSymbol(),
                first.getAsset().getName(),
                totalQuantity,
                totalCostBasis,
                averageCostBasis,
                first.getMarketPrice(),
                marketValue,
                unrealizedGain
        );
    }
}