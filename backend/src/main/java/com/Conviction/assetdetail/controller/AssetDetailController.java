package com.conviction.assetdetail.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.assetdetail.dto.AssetDetailResponse;
import com.conviction.assetdetail.service.AssetDetailService;

@RestController
@RequestMapping("/api/assets")
public class AssetDetailController {

    private final AssetDetailService assetDetailService;

    public AssetDetailController(
            AssetDetailService assetDetailService
    ) {
        this.assetDetailService = assetDetailService;
    }

    @GetMapping("/{symbol}/detail")
    public AssetDetailResponse getAssetDetail(
            @PathVariable String symbol
    ) {
        return assetDetailService.getAssetDetail(symbol);
    }
}