package com.conviction.cryptovaluation.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.asset.entity.Asset;
import com.conviction.asset.entity.Crypto;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.cryptovaluation.dto.CryptoValuationResponse;
import com.conviction.historicalprice.entity.HistoricalPrice;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;

@Service
public class CryptoValuationService {

    // PlanB S2F model constants: ln(market_cap) = B * ln(S2F) + A
    private static final double S2F_A = 14.6227;
    private static final double S2F_B = 3.31819;

    // BTC block reward post-April 2024 halving (next halving ~2028)
    private static final double BTC_BLOCKS_PER_YEAR   = 52_560.0; // 144/day * 365
    private static final double BTC_BLOCK_REWARD_2024 = 3.125;    // post-4th halving

    private static final int MA_200_WEEK = 1_400; // 200 weeks × 7 days

    private static final MathContext MC    = MathContext.DECIMAL64;
    private static final int         SCALE = 4;

    private final HistoricalPriceRepository priceRepo;
    private final AssetRepository           assetRepo;

    public CryptoValuationService(HistoricalPriceRepository priceRepo, AssetRepository assetRepo) {
        this.priceRepo = priceRepo;
        this.assetRepo = assetRepo;
    }

    public CryptoValuationResponse calculate(String symbol) {
        String sym   = symbol.toUpperCase();
        Asset  asset = assetRepo.findBySymbol(sym).orElse(null);

        // ---- 200-day MA — use FMP's pre-computed value stored during sync ----
        BigDecimal ma200Day = asset != null ? asset.getPriceAvg200() : null;
        if (ma200Day == null) {
            return insufficientDataResponse(sym);
        }

        // Current price — prefer latest historical close; fall back to priceAvg50 proxy
        List<HistoricalPrice> prices = priceRepo.findByAssetSymbolOrderByPriceDateAsc(sym);
        BigDecimal currentPrice = prices.isEmpty()
                ? null
                : prices.get(prices.size() - 1).getClose();
        if (currentPrice == null) {
            return insufficientDataResponse(sym);
        }

        // Mayer Multiple = price / 200-day MA  (FMP value)
        BigDecimal mayerMultiple = currentPrice.divide(ma200Day, SCALE, RoundingMode.HALF_UP);
        String     mayerSignal   = mayerSignal(mayerMultiple);

        // ---- 200-week MA — still calculated from historical prices (FMP doesn't provide this) ----
        BigDecimal ma200Week      = null;
        BigDecimal ma200WeekRatio = null;
        String     ma200WeekSignal = null;
        if (prices.size() >= MA_200_WEEK) {
            ma200Week      = tailAverage(prices, MA_200_WEEK);
            ma200WeekRatio = currentPrice.divide(ma200Week, SCALE, RoundingMode.HALF_UP);
            ma200WeekSignal = ma200WeekSignal(ma200WeekRatio);
        }

        // ---- Stock-to-Flow (BTC only) ----
        BigDecimal s2f = null, s2fModelPrice = null, s2fRatio = null;
        String s2fSignal = null;
        if (isBitcoin(sym) && asset instanceof Crypto c) {
            BigDecimal circulatingSupply = c.getCirculatingSupply();
            if (circulatingSupply != null && circulatingSupply.compareTo(BigDecimal.ZERO) > 0) {
                double annualFlow    = BTC_BLOCKS_PER_YEAR * BTC_BLOCK_REWARD_2024;
                double s2fDouble     = circulatingSupply.doubleValue() / annualFlow;
                s2f                  = BigDecimal.valueOf(s2fDouble).setScale(2, RoundingMode.HALF_UP);

                // PlanB model: market_cap = e^A × S2F^B  (USD)
                double modelMarketCap  = Math.exp(S2F_A) * Math.pow(s2fDouble, S2F_B);
                double modelPriceDouble = modelMarketCap / circulatingSupply.doubleValue();
                s2fModelPrice = BigDecimal.valueOf(modelPriceDouble).setScale(2, RoundingMode.HALF_UP);
                s2fRatio      = currentPrice.divide(s2fModelPrice, SCALE, RoundingMode.HALF_UP);
                s2fSignal     = s2fSignal(s2fRatio);
            }
        }

        return new CryptoValuationResponse(
                sym,
                currentPrice.setScale(2, RoundingMode.HALF_UP),
                ma200Day.setScale(2, RoundingMode.HALF_UP),
                mayerMultiple,
                mayerSignal,
                ma200Week != null ? ma200Week.setScale(2, RoundingMode.HALF_UP) : null,
                ma200WeekRatio,
                ma200WeekSignal,
                s2f,
                s2fModelPrice,
                s2fRatio,
                s2fSignal,
                false
        );
    }

    // ---- helpers ----

    private BigDecimal tailAverage(List<HistoricalPrice> prices, int n) {
        int from = prices.size() - n;
        BigDecimal sum = BigDecimal.ZERO;
        for (int i = from; i < prices.size(); i++) {
            sum = sum.add(prices.get(i).getClose());
        }
        return sum.divide(BigDecimal.valueOf(n), MC);
    }

    private boolean isBitcoin(String symbol) {
        return symbol.equals("BTCUSD") || symbol.equals("BTC");
    }

    private CryptoValuationResponse insufficientDataResponse(String symbol) {
        return new CryptoValuationResponse(
                symbol, null, null, null, null,
                null, null, null,
                null, null, null, null,
                true
        );
    }

    // ---- signal labels ----

    private String mayerSignal(BigDecimal mayer) {
        double v = mayer.doubleValue();
        if (v < 0.8)  return "UNDERVALUED";
        if (v < 1.5)  return "FAIR";
        if (v < 2.4)  return "ELEVATED";
        return "OVERVALUED";
    }

    private String ma200WeekSignal(BigDecimal ratio) {
        double v = ratio.doubleValue();
        if (v < 1.0)  return "BELOW_MA";     // historically strong buy zone
        if (v < 2.0)  return "FAIR";
        if (v < 3.5)  return "ELEVATED";
        return "OVERVALUED";
    }

    private String s2fSignal(BigDecimal ratio) {
        double v = ratio.doubleValue();
        if (v < 0.5)  return "BELOW_MODEL";
        if (v < 1.5)  return "NEAR_MODEL";
        if (v < 2.5)  return "ABOVE_MODEL";
        return "WELL_ABOVE_MODEL";
    }
}
