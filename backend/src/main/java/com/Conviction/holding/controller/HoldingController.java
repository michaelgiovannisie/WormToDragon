package com.conviction.holding.controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.holding.dto.HoldingResponse;
import com.conviction.holding.entity.Holding;
import com.conviction.holding.repository.HoldingRepository;

@RestController
@RequestMapping("/api/holdings")
public class HoldingController {

    private final HoldingRepository holdingRepository;

    public HoldingController(HoldingRepository holdingRepository) {
        this.holdingRepository = holdingRepository;
    }

    @GetMapping("/account/{accountId}")
    public List<HoldingResponse> getHoldingsByAccountId(@PathVariable UUID accountId) {
        return holdingRepository.findByAccountId(accountId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private HoldingResponse toResponse(Holding holding) {

    BigDecimal averageCostBasis =
            holding.getQuantityHeld().compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : holding.getTotalCostBasis()
                    .divide(
                            holding.getQuantityHeld(),
                            2,
                            RoundingMode.HALF_UP
                    );

    return new HoldingResponse(
            holding.getId(),
            holding.getAccount().getId(),
            holding.getAsset().getId(),
            holding.getAsset().getSymbol(),
            holding.getAsset().getName(),
            holding.getQuantityHeld(),
            holding.getTotalCostBasis(),
            averageCostBasis,
            holding.getActive(),
            holding.getLastCalculatedAt()
    );
}
}