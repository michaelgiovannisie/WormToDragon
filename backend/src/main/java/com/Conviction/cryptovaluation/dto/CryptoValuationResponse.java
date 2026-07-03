package com.conviction.cryptovaluation.dto;

import java.math.BigDecimal;

public record CryptoValuationResponse(
        String symbol,
        BigDecimal currentPrice,

        // Mayer Multiple = currentPrice / 200-day MA
        BigDecimal ma200Day,
        BigDecimal mayerMultiple,
        String mayerSignal,

        // 200-week MA
        BigDecimal ma200Week,
        BigDecimal ma200WeekRatio,   // currentPrice / ma200Week
        String ma200WeekSignal,

        // Stock-to-Flow (BTC only — null for other crypto)
        BigDecimal s2f,
        BigDecimal s2fModelPrice,
        BigDecimal s2fRatio,         // currentPrice / s2fModelPrice
        String s2fSignal,
        Double blockReward,          // the block reward used (default or user override)

        // true when there isn't enough price history to compute signals
        boolean insufficientData
) {}
