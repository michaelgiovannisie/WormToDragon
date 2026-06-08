package com.conviction.historicalprice.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.historicalprice.entity.HistoricalPrice;

public interface HistoricalPriceRepository
        extends JpaRepository<HistoricalPrice, UUID> {

    List<HistoricalPrice> findByAssetSymbolOrderByPriceDateAsc(String symbol);

    List<HistoricalPrice> findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(
            String symbol,
            LocalDate from,
            LocalDate to
    );

    Optional<HistoricalPrice> findByAssetSymbolAndPriceDate(
            String symbol,
            LocalDate priceDate
    );

    Optional<HistoricalPrice> findTopByAssetSymbolOrderByPriceDateDesc(
            String symbol
    );

    Optional<HistoricalPrice> findTopByAssetSymbolAndPriceDateLessThanEqualOrderByPriceDateDesc(
            String symbol,
            LocalDate priceDate
    );

    boolean existsByAssetIdAndPriceDate(UUID assetId, LocalDate priceDate);
}
