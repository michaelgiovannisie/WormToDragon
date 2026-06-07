package com.conviction.asset.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.asset.dto.AssetResponse;
import com.conviction.asset.dto.CreateAssetRequest;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.entity.Crypto;
import com.conviction.asset.entity.ETF;
import com.conviction.asset.entity.Equity;
import com.conviction.asset.repository.AssetRepository;

@Service
public class AssetService {

    private final AssetRepository assetRepository;

    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    public AssetResponse createAsset(CreateAssetRequest request) {
        String symbol = request.symbol().toUpperCase();

        if (assetRepository.existsBySymbol(symbol)) {
            throw new IllegalArgumentException("Asset already exists: " + symbol);
        }

        Asset asset = buildAsset(request, symbol);
        return toResponse(assetRepository.save(asset));
    }

    public List<AssetResponse> getAllAssets() {
        return assetRepository.findAll().stream().map(this::toResponse).toList();
    }

    public List<AssetResponse> searchAssets(String query) {
        if (query == null || query.isBlank()) return List.of();
        return assetRepository.searchActiveAssets(query.trim())
                .stream().limit(10).map(this::toResponse).toList();
    }

    private Asset buildAsset(CreateAssetRequest req, String symbol) {
        String type = req.assetType() == null ? "EQUITY" : req.assetType().toUpperCase();

        return switch (type) {
            case "ETF" -> {
                ETF etf = new ETF();
                applyCommon(etf, req, symbol);
                etf.setExpenseRatio(req.expenseRatio());
                etf.setUnderlying(req.underlying());
                etf.setFundFamily(req.fundFamily());
                yield etf;
            }
            case "CRYPTO" -> {
                Crypto crypto = new Crypto();
                applyCommon(crypto, req, symbol);
                crypto.setNetwork(req.network());
                crypto.setConsensusType(req.consensusType());
                crypto.setCirculatingSupply(req.circulatingSupply());
                crypto.setMarketCapRank(req.marketCapRank());
                yield crypto;
            }
            default -> {
                Equity equity = new Equity();
                applyCommon(equity, req, symbol);
                equity.setSector(req.sector());
                equity.setIndustry(req.industry());
                equity.setMarketCap(req.marketCap());
                equity.setPeRatio(req.peRatio());
                equity.setEps(req.eps());
                yield equity;
            }
        };
    }

    private void applyCommon(Asset asset, CreateAssetRequest req, String symbol) {
        asset.setSymbol(symbol);
        asset.setName(req.name());
        asset.setExchange(req.exchange());
        asset.setCurrency(
                req.currency() == null || req.currency().isBlank() ? "USD" : req.currency()
        );
    }

    public AssetResponse toResponse(Asset asset) {
        if (asset instanceof Equity eq) {
            return new AssetResponse(
                    asset.getId(), asset.getSymbol(), asset.getName(), "EQUITY",
                    asset.getExchange(), asset.getCurrency(), asset.getActive(), asset.getCreatedAt(),
                    eq.getSector(), eq.getIndustry(), eq.getMarketCap(), eq.getPeRatio(), eq.getEps(),
                    null, null, null,
                    null, null, null, null
            );
        }
        if (asset instanceof ETF etf) {
            return new AssetResponse(
                    asset.getId(), asset.getSymbol(), asset.getName(), "ETF",
                    asset.getExchange(), asset.getCurrency(), asset.getActive(), asset.getCreatedAt(),
                    null, null, null, null, null,
                    etf.getExpenseRatio(), etf.getUnderlying(), etf.getFundFamily(),
                    null, null, null, null
            );
        }
        if (asset instanceof Crypto c) {
            return new AssetResponse(
                    asset.getId(), asset.getSymbol(), asset.getName(), "CRYPTO",
                    asset.getExchange(), asset.getCurrency(), asset.getActive(), asset.getCreatedAt(),
                    null, null, null, null, null,
                    null, null, null,
                    c.getNetwork(), c.getConsensusType(), c.getCirculatingSupply(), c.getMarketCapRank()
            );
        }
        return new AssetResponse(
                asset.getId(), asset.getSymbol(), asset.getName(), asset.getAssetType(),
                asset.getExchange(), asset.getCurrency(), asset.getActive(), asset.getCreatedAt()
        );
    }
}
