package com.conviction.watchlist.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.conviction.watchlist.dto.WatchlistResponse;
import com.conviction.watchlist.service.WatchlistService;

@RestController
@RequestMapping("/api/watchlists")
public class WatchlistController {

    private final WatchlistService service;

    public WatchlistController(WatchlistService service) { this.service = service; }

    @PostMapping
    public WatchlistResponse create(
            @RequestParam UUID portfolioId,
            @RequestBody Map<String, String> body
    ) {
        return service.createWatchlist(portfolioId, body.get("name"));
    }

    @GetMapping
    public List<WatchlistResponse> list(@RequestParam UUID portfolioId) {
        return service.getWatchlists(portfolioId);
    }

    @GetMapping("/{watchlistId}")
    public WatchlistResponse get(@PathVariable UUID watchlistId) {
        return service.getWatchlist(watchlistId);
    }

    @PatchMapping("/{watchlistId}")
    public WatchlistResponse rename(
            @PathVariable UUID watchlistId,
            @RequestBody Map<String, String> body
    ) {
        return service.renameWatchlist(watchlistId, body.get("name"));
    }

    @DeleteMapping("/{watchlistId}")
    public void delete(@PathVariable UUID watchlistId) {
        service.deleteWatchlist(watchlistId);
    }

    @PostMapping("/{watchlistId}/items")
    public WatchlistResponse addItem(
            @PathVariable UUID watchlistId,
            @RequestBody Map<String, String> body
    ) {
        return service.addItem(watchlistId, body.get("symbol"));
    }

    @DeleteMapping("/{watchlistId}/items/{symbol}")
    public void removeItem(@PathVariable UUID watchlistId, @PathVariable String symbol) {
        service.removeItem(watchlistId, symbol);
    }
}
