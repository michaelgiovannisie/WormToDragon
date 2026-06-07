package com.conviction.fmp;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.conviction.asset.dto.AssetResponse;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.entity.Equity;
import com.conviction.asset.entity.ETF;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.asset.service.AssetService;

@Service
public class FMPProfileSync {

    private final FMPClient fmp;
    private final AssetRepository assetRepository;
    private final AssetService assetService;

    public FMPProfileSync(FMPClient fmp, AssetRepository assetRepository, AssetService assetService) {
        this.fmp = fmp;
        this.assetRepository = assetRepository;
        this.assetService = assetService;
    }

    @SuppressWarnings("unchecked")
    public AssetResponse sync(String symbol) {
        List<Map<String, Object>> result = fmp.get("/profile", List.class, "symbol", symbol);

        if (result == null || result.isEmpty()) {
            throw new IllegalStateException("No profile returned for: " + symbol);
        }

        Map<String, Object> p = result.get(0);

        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Asset not found: " + symbol));

        if (asset instanceof Equity eq) {
            eq.setName(str(p, "companyName"));
            eq.setExchange(str(p, "exchangeShortName"));
            eq.setSector(str(p, "sector"));
            eq.setIndustry(str(p, "industry"));
            eq.setMarketCap(toBD(p.get("mktCap")));
            eq.setPeRatio(toBD(p.get("pe")));
            // eps comes from key-metrics-ttm, skip here
            assetRepository.save(eq);
        } else if (asset instanceof ETF etf) {
            etf.setName(str(p, "companyName"));
            etf.setExchange(str(p, "exchangeShortName"));
            assetRepository.save(etf);
        } else {
            asset.setName(str(p, "companyName"));
            asset.setExchange(str(p, "exchangeShortName"));
            assetRepository.save(asset);
        }

        return assetService.toResponse(assetRepository.findBySymbol(symbol.toUpperCase()).get());
    }

    private String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : null;
    }

    private BigDecimal toBD(Object val) {
        if (val == null) return null;
        try { return new BigDecimal(val.toString()); }
        catch (Exception e) { return null; }
    }
}
