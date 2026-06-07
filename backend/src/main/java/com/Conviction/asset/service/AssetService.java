package com.conviction.asset.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.conviction.asset.dto.AssetResponse;
import com.conviction.asset.dto.CreateAssetRequest;
import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;

@Service
public class AssetService {

    private final AssetRepository assetRepository;

    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    public AssetResponse createAsset(CreateAssetRequest request) {
        String normalizedSymbol = request.symbol().toUpperCase();

        if (assetRepository.existsBySymbol(normalizedSymbol)) {
            throw new IllegalArgumentException("Asset already exists");
        }

        Asset asset = new Asset();
        asset.setSymbol(normalizedSymbol);
        asset.setName(request.name());
        asset.setAssetType(request.assetType());
        asset.setExchange(request.exchange());
        asset.setCurrency(
                request.currency() == null || request.currency().isBlank()
                        ? "USD"
                        : request.currency()
        );

        Asset savedAsset = assetRepository.save(asset);

        return toResponse(savedAsset);
    }

    public List<AssetResponse> getAllAssets() {
        return assetRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<AssetResponse> searchAssets(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        return assetRepository.searchActiveAssets(query.trim())
                .stream()
                .limit(10)
                .map(this::toResponse)
                .toList();
    }

    private AssetResponse toResponse(Asset asset) {
        return new AssetResponse(
                asset.getId(),
                asset.getSymbol(),
                asset.getName(),
                asset.getAssetType(),
                asset.getExchange(),
                asset.getCurrency(),
                asset.getActive(),
                asset.getCreatedAt()
        );
    }
}
