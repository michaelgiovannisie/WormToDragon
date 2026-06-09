package com.conviction.valuation.strategy;

import java.math.BigDecimal;

import com.conviction.valuation.dto.ValuationRequest;
import com.conviction.valuation.enums.ValuationModelType;

public interface ValuationStrategy {

    ValuationModelType getModelType();

    /**
     * Returns the primary intrinsic value per share given the request inputs.
     * Each strategy interprets the fields of ValuationRequest differently.
     */
    BigDecimal calculateIntrinsicValue(ValuationRequest request);

    /**
     * Returns an optional exit-multiple cross-check intrinsic value.
     * Only DCF-based models override this; all others return null by default.
     */
    default BigDecimal calculateExitMultipleValue(ValuationRequest request) {
        return null;
    }
}
