package com.conviction.fmp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.conviction.historicalprice.dto.HistoricalPriceResponse;
import com.conviction.historicalprice.dto.UpsertHistoricalPriceRequest;
import com.conviction.historicalprice.service.HistoricalPriceService;

@Service
public class FMPHistoricalPriceSync {

    private final FMPClient fmp;
    private final HistoricalPriceService historicalPriceService;

    public FMPHistoricalPriceSync(FMPClient fmp, HistoricalPriceService historicalPriceService) {
        this.fmp = fmp;
        this.historicalPriceService = historicalPriceService;
    }

    @SuppressWarnings("unchecked")
    public List<HistoricalPriceResponse> sync(String symbol, LocalDate from, LocalDate to) {
        String path = "/historical-price-eod/full";

        String[] params = (from != null && to != null)
                ? new String[]{"symbol", symbol, "from", from.toString(), "to", to.toString()}
                : new String[]{"symbol", symbol};

        List<Map<String, Object>> rows = fmp.get(path, List.class, params);

        if (rows == null || rows.isEmpty()) {
            return List.of();
        }

        List<UpsertHistoricalPriceRequest> requests = rows.stream()
                .map(this::toUpsertRequest)
                .toList();

        return historicalPriceService.upsertBatch(symbol, requests);
    }

    public List<HistoricalPriceResponse> syncFull(String symbol) {
        // Default to 2 years to avoid huge payloads
        return sync(symbol, LocalDate.now().minusYears(2), LocalDate.now());
    }

    private UpsertHistoricalPriceRequest toUpsertRequest(Map<String, Object> row) {
        return new UpsertHistoricalPriceRequest(
                LocalDate.parse(row.get("date").toString()),
                toBD(row.get("open")),
                toBD(row.get("high")),
                toBD(row.get("low")),
                toBD(row.get("close")),
                toBD(row.get("adjClose") != null ? row.get("adjClose") : row.get("close")),
                row.get("volume") != null ? Long.valueOf(row.get("volume").toString().split("\\.")[0]) : null
        );
    }

    private BigDecimal toBD(Object val) {
        if (val == null) return null;
        try { return new BigDecimal(val.toString()); }
        catch (Exception e) { return null; }
    }
}
