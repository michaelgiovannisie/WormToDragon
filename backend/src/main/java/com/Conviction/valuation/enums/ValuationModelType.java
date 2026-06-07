package com.conviction.valuation.enums;

public enum ValuationModelType {
    EPS_MULTIPLE,      // legacy — simple EPS × growth × terminal multiple
    OWNER_EARNINGS,    // legacy — owner earnings DCF
    DCF,               // discounted cash flow
    PEG,               // price/earnings to growth (Peter Lynch)
    GRAHAM,            // Benjamin Graham Number
    CRYPTO_RISK        // risk-adjusted intrinsic value for crypto assets
}