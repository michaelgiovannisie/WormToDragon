package com.conviction.marketdata.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.marketdata.dto.UpdateMarketPriceRequest;
import com.conviction.marketdata.dto.UpdateMarketPriceResponse;
import com.conviction.marketdata.provider.MarketPriceProvider;
import com.conviction.portfolio.snapshot.service.PortfolioSnapshotService;

@Service
public class MarketDataService {

    private final HoldingRepository holdingRepository;
    private final PortfolioSnapshotService snapshotService;
    private final MarketPriceProvider marketPriceProvider;

    public MarketDataService(
            HoldingRepository holdingRepository,
            PortfolioSnapshotService snapshotService,
            MarketPriceProvider marketPriceProvider
    ) {
        this.holdingRepository = holdingRepository;
        this.snapshotService = snapshotService;
        this.marketPriceProvider = marketPriceProvider;
    }

    public UpdateMarketPriceResponse updateManualPrice(
        UpdateMarketPriceRequest request
        ) {
        List<Holding> holdings = holdingRepository.findByAssetSymbolWithAccountAndPortfolio(
                request.symbol()
        );

        Set<UUID> affectedPortfolioIds = holdings.stream()
            .map(holding -> holding.getAccount().getPortfolio().getId())
            .collect(Collectors.toSet());

        for (Holding holding : holdings) {
            BigDecimal marketValue =
                    holding.getQuantityHeld()
                            .multiply(request.marketPrice());

            BigDecimal unrealizedGain =
                    marketValue.subtract(holding.getTotalCostBasis());

            holding.setMarketPrice(request.marketPrice());
            holding.setMarketValue(marketValue);
            holding.setUnrealizedGain(unrealizedGain);
        }

        holdingRepository.saveAll(holdings);

        affectedPortfolioIds.forEach(snapshotService::createOrUpdateTodaySnapshot);

        return new UpdateMarketPriceResponse(
                request.symbol(),
                request.marketPrice(),
                holdings.size()
        );
    }

    public UpdateMarketPriceResponse refreshPrice(String symbol) {
        BigDecimal latestPrice = marketPriceProvider.getLatestPrice(symbol);

        return updateManualPrice(
                new UpdateMarketPriceRequest(
                        symbol,
                        latestPrice
                )
        );
    }
}