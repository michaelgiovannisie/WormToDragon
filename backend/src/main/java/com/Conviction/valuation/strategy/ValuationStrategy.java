package com.conviction.valuation.strategy;

import java.math.BigDecimal;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

public interface ValuationStrategy {

    ValuationModelType getModelType();

    /**
     * Returns the intrinsic value per share given the request inputs.
     * Each strategy interprets the fields of ValuationRequest differently.
     */
    BigDecimal calculateIntrinsicValue(ValuationRequest request);
}
