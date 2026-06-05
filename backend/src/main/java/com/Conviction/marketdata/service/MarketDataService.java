package com.conviction.marketdata.service;

import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;
import com.conviction.marketdata.dto.UpdateMarketPriceRequest;
import com.conviction.marketdata.dto.UpdateMarketPriceResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class MarketDataService {

    private final HoldingRepository holdingRepository;

    public MarketDataService(HoldingRepository holdingRepository) {
        this.holdingRepository = holdingRepository;
    }

    public UpdateMarketPriceResponse updateMarketPrice(
            UpdateMarketPriceRequest request
    ) {
        List<Holding> holdings =
                holdingRepository.findByAssetSymbol(request.symbol());

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

        return new UpdateMarketPriceResponse(
                request.symbol(),
                request.marketPrice(),
                holdings.size()
        );
    }
}