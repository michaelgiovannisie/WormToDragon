package com.conviction.holding.service;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;

import com.conviction.account.entity.Account;
import com.conviction.asset.entity.Asset;
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
}