package com.conviction.projection.controller;

import com.conviction.projection.dto.RebuildProjectionResponse;
import com.conviction.projection.service.ProjectionRebuildService;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/projections")
public class ProjectionRebuildController {

    private final ProjectionRebuildService projectionRebuildService;

    public ProjectionRebuildController(
            ProjectionRebuildService projectionRebuildService
    ) {
        this.projectionRebuildService = projectionRebuildService;
    }

    @PostMapping("/accounts/{accountId}/assets/{assetId}/rebuild")
    public RebuildProjectionResponse rebuildAccountAsset(
            @PathVariable UUID accountId,
            @PathVariable UUID assetId
    ) {
        return projectionRebuildService.rebuildAccountAsset(
                accountId,
                assetId
        );
    }
}
