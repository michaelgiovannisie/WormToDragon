package com.conviction.historicalprice.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.historicalprice.dto.HistoricalPriceResponse;
import com.conviction.historicalprice.dto.UpsertHistoricalPriceRequest;
import com.conviction.historicalprice.entity.HistoricalPrice;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;

@Service
public class HistoricalPriceService {

    private final HistoricalPriceRepository priceRepository;
    private final AssetRepository assetRepository;

    public HistoricalPriceService(
            HistoricalPriceRepository priceRepository,
            AssetRepository assetRepository
    ) {
        this.priceRepository = priceRepository;
        this.assetRepository = assetRepository;
    }

    public List<HistoricalPriceResponse> getPrices(String symbol) {
        return priceRepository
                .findByAssetSymbolOrderByPriceDateAsc(symbol)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<HistoricalPriceResponse> getPricesInRange(
            String symbol,
            LocalDate from,
            LocalDate to
    ) {
        return priceRepository
                .findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(
                        symbol, from, to
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public HistoricalPriceResponse getLatestPrice(String symbol) {
        return priceRepository
                .findTopByAssetSymbolOrderByPriceDateDesc(symbol)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No historical prices found for symbol: " + symbol
                ));
    }

    public HistoricalPriceResponse upsert(
            String symbol,
            UpsertHistoricalPriceRequest request
    ) {
        Asset asset = assetRepository.findBySymbol(symbol)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Asset not found: " + symbol
                ));

        HistoricalPrice price = priceRepository
                .findByAssetSymbolAndPriceDate(symbol, request.priceDate())
                .orElseGet(HistoricalPrice::new);

        price.setAsset(asset);
        price.setPriceDate(request.priceDate());
        price.setOpen(request.open());
        price.setHigh(request.high());
        price.setLow(request.low());
        price.setClose(request.close());
        price.setAdjustedClose(
                request.adjustedClose() != null
                        ? request.adjustedClose()
                        : request.close()
        );
        price.setVolume(request.volume());

        return toResponse(priceRepository.save(price));
    }

    public List<HistoricalPriceResponse> upsertBatch(
            String symbol,
            List<UpsertHistoricalPriceRequest> requests
    ) {
        return requests.stream()
                .map(r -> upsert(symbol, r))
                .toList();
    }

    private HistoricalPriceResponse toResponse(HistoricalPrice p) {
        return new HistoricalPriceResponse(
                p.getId(),
                p.getAsset().getSymbol(),
                p.getPriceDate(),
                p.getOpen(),
                p.getHigh(),
                p.getLow(),
                p.getClose(),
                p.getAdjustedClose(),
                p.getVolume()
        );
    }
}
