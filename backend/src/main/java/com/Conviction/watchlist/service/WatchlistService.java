package com.conviction.watchlist.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.conviction.asset.entity.Asset;
import com.conviction.asset.repository.AssetRepository;
import com.conviction.historicalprice.entity.HistoricalPrice;
import com.conviction.historicalprice.repository.HistoricalPriceRepository;
import com.conviction.portfolio.entity.Portfolio;
import com.conviction.portfolio.repository.PortfolioRepository;
import com.conviction.watchlist.dto.WatchlistItemResponse;
import com.conviction.watchlist.dto.WatchlistResponse;
import com.conviction.watchlist.entity.Watchlist;
import com.conviction.watchlist.entity.WatchlistItem;
import com.conviction.watchlist.repository.WatchlistItemRepository;
import com.conviction.watchlist.repository.WatchlistRepository;

@Service
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final WatchlistItemRepository itemRepository;
    private final PortfolioRepository portfolioRepository;
    private final AssetRepository assetRepository;
    private final HistoricalPriceRepository priceRepository;

    public WatchlistService(
            WatchlistRepository watchlistRepository,
            WatchlistItemRepository itemRepository,
            PortfolioRepository portfolioRepository,
            AssetRepository assetRepository,
            HistoricalPriceRepository priceRepository
    ) {
        this.watchlistRepository = watchlistRepository;
        this.itemRepository = itemRepository;
        this.portfolioRepository = portfolioRepository;
        this.assetRepository = assetRepository;
        this.priceRepository = priceRepository;
    }

    @Transactional
    public WatchlistResponse createWatchlist(UUID portfolioId, String name) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        Watchlist wl = new Watchlist();
        wl.setName(name);
        wl.setPortfolio(portfolio);
        return toResponse(watchlistRepository.save(wl), false);
    }

    @Transactional(readOnly = true)
    public List<WatchlistResponse> getWatchlists(UUID portfolioId) {
        return watchlistRepository.findByPortfolioIdOrderByCreatedAtDesc(portfolioId)
                .stream().map(wl -> toResponse(wl, false)).toList();
    }

    @Transactional(readOnly = true)
    public WatchlistResponse getWatchlist(UUID watchlistId) {
        Watchlist wl = watchlistRepository.findById(watchlistId)
                .orElseThrow(() -> new IllegalArgumentException("Watchlist not found"));
        return toResponse(wl, true);
    }

    @Transactional
    public WatchlistResponse renameWatchlist(UUID watchlistId, String name) {
        Watchlist wl = watchlistRepository.findById(watchlistId)
                .orElseThrow(() -> new IllegalArgumentException("Watchlist not found"));
        wl.setName(name);
        return toResponse(watchlistRepository.save(wl), false);
    }

    @Transactional
    public void deleteWatchlist(UUID watchlistId) {
        watchlistRepository.deleteById(watchlistId);
    }

    @Transactional
    public WatchlistResponse addItem(UUID watchlistId, String symbol) {
        Watchlist wl = watchlistRepository.findById(watchlistId)
                .orElseThrow(() -> new IllegalArgumentException("Watchlist not found"));
        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Asset not found in library: " + symbol + ". Add it to the library first."));
        if (itemRepository.existsByWatchlistIdAndAssetSymbol(watchlistId, symbol.toUpperCase())) {
            return toResponse(wl, true); // already present — idempotent
        }
        WatchlistItem item = new WatchlistItem();
        item.setWatchlist(wl);
        item.setAsset(asset);
        itemRepository.save(item);
        watchlistRepository.flush();
        return toResponse(watchlistRepository.findById(watchlistId).get(), true);
    }

    @Transactional
    public void removeItem(UUID watchlistId, String symbol) {
        itemRepository.findByWatchlistIdAndAssetSymbol(watchlistId, symbol.toUpperCase())
                .ifPresent(itemRepository::delete);
    }

    // ── mapping ──────────────────────────────────────────────────────────────

    private WatchlistResponse toResponse(Watchlist wl, boolean includeItems) {
        List<WatchlistItemResponse> items = includeItems
                ? wl.getItems().stream().map(this::toItemResponse).toList()
                : List.of();
        return new WatchlistResponse(
                wl.getId(), wl.getName(),
                wl.getPortfolio().getId(),
                wl.getItems().size(),
                wl.getCreatedAt(),
                items
        );
    }

    private WatchlistItemResponse toItemResponse(WatchlistItem item) {
        Asset asset = item.getAsset();
        String sym = asset.getSymbol();

        // Latest price
        var latest = priceRepository.findTopByAssetSymbolOrderByPriceDateDesc(sym);
        BigDecimal price = latest.map(HistoricalPrice::getClose).orElse(null);

        // Day change — compare latest vs previous day
        BigDecimal dayChange = null;
        BigDecimal dayChangePct = null;
        if (latest.isPresent()) {
            LocalDate latestDate = latest.get().getPriceDate();
            var prev = priceRepository.findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(
                    sym, latestDate.minusDays(5), latestDate.minusDays(1));
            if (!prev.isEmpty()) {
                BigDecimal prevClose = prev.get(prev.size() - 1).getClose();
                if (price != null && prevClose != null && prevClose.compareTo(BigDecimal.ZERO) != 0) {
                    dayChange = price.subtract(prevClose);
                    dayChangePct = dayChange.divide(prevClose, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100));
                }
            }
        }

        // 30-day sparkline
        List<BigDecimal> sparkline = priceRepository
                .findByAssetSymbolAndPriceDateBetweenOrderByPriceDateAsc(
                        sym,
                        LocalDate.now().minusDays(30),
                        LocalDate.now())
                .stream().map(HistoricalPrice::getClose).toList();

        return new WatchlistItemResponse(
                item.getId(), sym, asset.getName(), asset.getAssetType(),
                asset.getExchange(), price, dayChange, dayChangePct, sparkline, item.getAddedAt()
        );
    }
}
