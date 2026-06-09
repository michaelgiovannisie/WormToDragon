package com.conviction.assetdetail.dto;

import java.math.BigDecimal;
import java.util.List;

import com.conviction.holding.dto.HoldingResponse;
import com.conviction.tax.dto.TaxLotAllocationResponse;
import com.conviction.tax.dto.TaxLotResponse;
import com.conviction.transaction.dto.TransactionResponse;
import com.conviction.valuation.entity.ValuationScenario;

public record AssetDetailResponse(
        String symbol,
        String assetName,
        HoldingResponse holding,
        List<TransactionResponse> transactions,
        List<ValuationScenario> valuationScenarios,
        List<TaxLotResponse> taxLots,
        List<TaxLotAllocationResponse> taxLotAllocations,
        BigDecimal eps,
        BigDecimal freeCashFlowPerShare,
        BigDecimal revenueGrowthTTM
) {
}