package com.conviction.tax.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.tax.entity.TaxLot;
import com.conviction.tax.repository.TaxLotRepository;

@RestController
@RequestMapping("/api/tax-lots")
public class TaxLotController {

    private final TaxLotRepository taxLotRepository;

    public TaxLotController(TaxLotRepository taxLotRepository) {
        this.taxLotRepository = taxLotRepository;
    }

    @GetMapping("/assets/{symbol}")
    public List<TaxLotResponse> getTaxLotsByAsset(
            @PathVariable String symbol
    ) {
        return taxLotRepository
                .findByAssetSymbolWithDetails(symbol.toUpperCase())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private TaxLotResponse toResponse(TaxLot lot) {
        return new TaxLotResponse(
                lot.getId(),
                lot.getAccount().getId(),
                lot.getAsset().getId(),
                lot.getAsset().getSymbol(),
                lot.getAsset().getName(),
                lot.getBuyTransaction().getId(),
                lot.getQuantityPurchased(),
                lot.getQuantityRemaining(),
                lot.getCostBasisPerUnit(),
                lot.getTotalCostBasis(),
                lot.getAcquisitionDate(),
                lot.getClosed(),
                lot.getCreatedAt()
        );
    }
}