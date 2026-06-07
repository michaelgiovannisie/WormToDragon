package com.conviction.holding.mapper;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.conviction.holding.dto.HoldingResponse;
import com.conviction.holding.entity.Holding;

@Component
public class HoldingMapper {

    public HoldingResponse toResponse(Holding holding) {
        BigDecimal totalCostBasis =
                holding.getTotalCostBasis() == null
                        ? BigDecimal.ZERO
                        : holding.getTotalCostBasis();

        BigDecimal quantityHeld =
                holding.getQuantityHeld() == null
                        ? BigDecimal.ZERO
                        : holding.getQuantityHeld();

        BigDecimal unrealizedGain =
                holding.getUnrealizedGain() == null
                        ? BigDecimal.ZERO
                        : holding.getUnrealizedGain();

        BigDecimal averageCostBasis =
                quantityHeld.compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : totalCostBasis.divide(
                                quantityHeld,
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal unrealizedGainPercent =
                totalCostBasis.compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : unrealizedGain
                                .divide(
                                        totalCostBasis,
                                        4,
                                        RoundingMode.HALF_UP
                                )
                                .multiply(BigDecimal.valueOf(100));

        return new HoldingResponse(
                holding.getId(),
                holding.getAccount().getId(),
                holding.getAsset().getId(),
                holding.getAsset().getSymbol(),
                holding.getAsset().getName(),
                quantityHeld,
                totalCostBasis,
                averageCostBasis,
                holding.getMarketPrice() == null
                        ? BigDecimal.ZERO
                        : holding.getMarketPrice(),
                holding.getMarketValue() == null
                        ? BigDecimal.ZERO
                        : holding.getMarketValue(),
                unrealizedGain,
                unrealizedGainPercent,
                holding.getActive(),
                holding.getLastCalculatedAt()
        );
    }
}
