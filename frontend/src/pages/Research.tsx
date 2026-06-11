import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import { API } from "../constants";
import { C, sectionStyle, labelStyle, tooltipStyle, pillStyle, tableCellStyle } from "../theme";
import { Nasdaq100SyncWidget } from "../components/Nasdaq100SyncWidget";

function fmt$(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-$" : "$") + abs;
}

const MODELS = ["DCF", "OWNER_EARNINGS", "PEG", "GRAHAM", "DDM"] as const;
type Model = typeof MODELS[number];

const MODEL_LABELS: Record<Model, string> = {
  DCF:            "Discounted Cash Flow",
  OWNER_EARNINGS: "Owner Earnings (FCF)",
  PEG:            "PEG Ratio (Peter Lynch)",
  GRAHAM:         "Graham Number",
  DDM:            "Dividend Discount (DDM)",
};

// Extended labels for legacy model types that may appear in saved scenarios
const MODEL_LABELS_EXT: Record<string, string> = {
  ...MODEL_LABELS,
  CRYPTO_RISK:  "Crypto Risk-Adjusted",
  EPS_MULTIPLE: "EPS Multiple",
};

export default function Research() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery]               = useState("");
  const [results, setResults]           = useState<any[]>([]);
  const [symbol, setSymbol]             = useState<string | null>(searchParams.get("symbol"));
  const [detail, setDetail]             = useState<any>(null);
  const [prices, setPrices]             = useState<any[]>([]);
  const [targetMos, setTargetMos]       = useState(25);
  const [showForm, setShowForm]         = useState(false);
  const [model, setModel]               = useState<Model>("DCF");
  const [dcaRec, setDcaRec]             = useState<any>(null);
  const [dcaCash, setDcaCash]           = useState("1000");
  const [dcaAddAmount, setDcaAddAmount] = useState("1000");
  const [activeIVLines, setActiveIVLines] = useState<Set<string>>(new Set());
  const [showIVToggles, setShowIVToggles] = useState(false);
  const [txFilter, setTxFilter]           = useState<"all" | "buy" | "sell">("all");
  const [presetsError, setPresetsError]   = useState<string | null>(null);
  const [dcaLoading, setDcaLoading]       = useState(false);
  const [lotSort, setLotSort]             = useState<{ col: string; dir: "asc" | "desc" }>({ col: "acquisitionDate", dir: "asc" });
  const [formVals, setFormVals]         = useState({
    currentPrice: "", earningsPerShare: "", freeCashFlowPerShare: "",
    growthRatePercent: "", discountRatePercent: "", years: "10",
    terminalGrowthRatePercent: "2.5", exitMultiple: "20", bookValuePerShare: "", dividendPerShare: "",
  });
  const [submitting, setSubmitting]     = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [priceRange, setPriceRange]     = useState("1y");
  const searchTimeout                   = useRef<number | null>(null);

  const PRICE_RANGES = ["1w","1m","3m","6m","ytd","1y","5y","all"];

  // Sync URL param → symbol state
  useEffect(() => {
    const s = searchParams.get("symbol");
    if (s) setSymbol(s);
  }, [searchParams]);

  const [adding, setAdding] = useState(false);

  // Search debounce — queries FMP universe directly
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const q = query.trim();
    if (q.length < 1) { setResults([]); return; }
    searchTimeout.current = window.setTimeout(() => {
      fetch(`${API}/fmp/search?query=${encodeURIComponent(q)}`)
        .then(r => r.json()).then(setResults).catch(console.error);
    }, 300);
  }, [query]);

  // Load asset detail
  useEffect(() => {
    if (!symbol) { setDetail(null); setPrices([]); return; }
    setDetail(null);
    setPrices([]);
    setPriceRange("1y");
    setShowForm(false);
    setValuationError(null);
    setPresetsError(null);
    setActiveIVLines(new Set());
    setShowIVToggles(false);
    setSearchParams({ symbol });

    fetch(`${API}/assets/${symbol}/detail`)
      .then(r => r.json()).then(d => {
        setDetail(d);
        const price      = d?.latestPrice ?? d?.holding?.marketPrice;
        const eps        = d?.eps;
        const fcf        = d?.freeCashFlowPerShare;
        const bvps       = d?.bookValuePerShare;
        const div        = d?.dividendPerShare;
        const rawGrowth  = d?.epsGrowth; // stored as decimal e.g. 0.08
        const growth     = rawGrowth != null
          ? String(Math.round(rawGrowth * 100 * 10) / 10)  // e.g. 0.083 → "8.3"
          : "";
        setFormVals(prev => ({
          ...prev,
          ...(price  != null ? { currentPrice:         String(price) } : {}),
          ...(eps    != null ? { earningsPerShare:      String(eps)   } : {}),
          ...(fcf    != null ? { freeCashFlowPerShare:  String(fcf)   } : {}),
          ...(bvps   != null ? { bookValuePerShare:     String(bvps)  } : {}),
          ...(div    != null ? { dividendPerShare:      String(div)   } : {}),
          ...(growth          ? { growthRatePercent:    growth        } : {}),
          discountRatePercent:       prev.discountRatePercent || "10",
          years:                     prev.years               || "10",
          terminalGrowthRatePercent: prev.terminalGrowthRatePercent || "2.5",
          exitMultiple:              prev.exitMultiple         || "20",
        }));
      }).catch(console.error);

    fetch(`${API}/historical-prices/${symbol}`)
      .then(r => r.json()).then(d => setPrices(Array.isArray(d) ? d : [])).catch(console.error);

    setDcaRec(null);
    setDcaLoading(true);
    fetch(`${API}/dca/${symbol}/recommendation?availableCash=${dcaCash}`)
      .then(r => r.json()).then(setDcaRec).catch(console.error)
      .finally(() => setDcaLoading(false));

    fetch(`${API}/financials/${symbol}`)
      .then(r => r.json()).then(d => setFinancials({ annual: d?.annual ?? [], quarterly: d?.quarterly ?? [] })).catch(console.error);
    // ^^^ reads from DB (no FMP call) — use Sync to refresh

    fetch(`${API}/fmp/${symbol}/dividends`)
      .then(r => r.json()).then(d => setDividends(Array.isArray(d) ? d : [])).catch(console.error);
  }, [symbol]);

  const selectSymbol = async (s: string, inLibrary: boolean) => {
    setQuery("");
    setResults([]);
    if (!inLibrary) {
      setAdding(true);
      try {
        await fetch(`${API}/fmp/add-to-library/${s}`, { method: "POST" });
      } catch (e) { console.error(e); }
      finally { setAdding(false); }
    }
    setSymbol(s);
  };

  const clearSymbol = () => {
    setSymbol(null);
    setDetail(null);
    setPrices([]);
    setSearchParams({});
  };

  const refreshDCA = (cash: string) => {
    if (!symbol) return;
    setDcaRec(null);
    setDcaLoading(true);
    fetch(`${API}/dca/${symbol}/recommendation?availableCash=${cash}`)
      .then(r => r.json()).then(setDcaRec).catch(console.error)
      .finally(() => setDcaLoading(false));
  };

  const [financials, setFinancials]   = useState<{ annual: any[], quarterly: any[] }>({ annual: [], quarterly: [] });
  const [dividends, setDividends]     = useState<any[]>([]);
  const [finTab, setFinTab]           = useState<"profitability"|"growth"|"health"|"valuation"|"dividend">("profitability");
  const [finPeriod, setFinPeriod]     = useState<"annual"|"quarter">("annual");
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState<string | null>(null);

  const syncFromFMP = async () => {
    if (!symbol) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API}/fmp/${symbol}/sync-all`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Reload prices, detail, and financials in parallel
      const [newPrices, newDetail, newFin] = await Promise.all([
        fetch(`${API}/historical-prices/${symbol}`).then(r => r.json()),
        fetch(`${API}/assets/${symbol}/detail`).then(r => r.json()),
        fetch(`${API}/financials/${symbol}/sync`, { method: "POST" }).then(r => r.json()),
      ]);
      setPrices(Array.isArray(newPrices) ? newPrices : []);
      setDetail(newDetail);
      const finRows = { annual: newFin?.annual ?? [], quarterly: newFin?.quarterly ?? [] };
      setFinancials(finRows);
      // Refresh DCA recommendation with latest price
      refreshDCA(dcaCash);
      setSyncMsg(finRows.annual.length > 0
        ? `Synced: ${data.historicalPricesSynced} price bars, profile + metrics + financials updated.`
        : `Synced: ${data.historicalPricesSynced} price bars, profile + metrics updated, no financial data for this symbol.`
      );
      // Pre-fill valuation form — prefer reloaded detail, fall back to sync response
      const eps       = newDetail?.eps       ?? data.metrics?.epsTTM;
      const fcf       = newDetail?.freeCashFlowPerShare ?? data.metrics?.freeCashFlowPerShareTTM;
      const bvps      = newDetail?.bookValuePerShare ?? data.metrics?.bookValuePerShareTTM;
      const div       = newDetail?.dividendPerShare ?? data.metrics?.dividendPerShareTTM;
      const price     = newDetail?.latestPrice ?? newDetail?.holding?.marketPrice;
      const rawGrowth = newDetail?.epsGrowth;
      const growth    = rawGrowth != null ? String(Math.round(rawGrowth * 100 * 10) / 10) : null;
      setFormVals(prev => ({
        ...prev,
        ...(eps    != null ? { earningsPerShare:     String(eps)   } : {}),
        ...(fcf    != null ? { freeCashFlowPerShare: String(fcf)   } : {}),
        ...(bvps   != null ? { bookValuePerShare:    String(bvps)  } : {}),
        ...(div    != null ? { dividendPerShare:     String(div)   } : {}),
        ...(price  != null ? { currentPrice:         String(price) } : {}),
        ...(growth != null ? { growthRatePercent:    growth        } : {}),
      }));
    } catch (e: any) {
      setSyncMsg("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunValuation = async () => {
    if (!symbol) return;
    setSubmitting(true);
    setValuationError(null);
    try {
      const res = await fetch(`${API}/valuations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          modelType: model,
          caseType: "BASE",
          currentPrice:              Number(formVals.currentPrice),
          earningsPerShare:          model === "DDM"
            ? (formVals.dividendPerShare  ? Number(formVals.dividendPerShare)  : null)
            : (formVals.earningsPerShare  ? Number(formVals.earningsPerShare)  : null),
          freeCashFlowPerShare:      formVals.freeCashFlowPerShare      ? Number(formVals.freeCashFlowPerShare)      : null,
          bookValuePerShare:         formVals.bookValuePerShare         ? Number(formVals.bookValuePerShare)         : null,
          growthRatePercent:         Number(formVals.growthRatePercent),
          discountRatePercent:       Number(formVals.discountRatePercent),
          years:                     Number(formVals.years),
          terminalGrowthRatePercent: Number(formVals.terminalGrowthRatePercent),
          exitMultiple:              formVals.exitMultiple               ? Number(formVals.exitMultiple)              : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Reload detail to pick up new scenario
      const updated = await fetch(`${API}/assets/${symbol}/detail`).then(r => r.json());
      setDetail(updated);
      setPresetsError(null);
      setShowForm(false);
    } catch (e: any) {
      setValuationError(e.message ?? "Calculation failed");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunPresets = async () => {
    if (!symbol || !formVals.currentPrice) return;
    if (!formVals.earningsPerShare && !formVals.freeCashFlowPerShare) {
      setPresetsError("Enter EPS or FCF per Share before running presets.");
      return;
    }
    setSubmitting(true);
    setPresetsError(null);
    try {
      const presetsRes = await fetch(`${API}/valuations/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          modelType: model,
          currentPrice:         Number(formVals.currentPrice),
          earningsPerShare:     formVals.earningsPerShare     ? Number(formVals.earningsPerShare)     : null,
          freeCashFlowPerShare: formVals.freeCashFlowPerShare ? Number(formVals.freeCashFlowPerShare) : null,
        }),
        // Note: presets use hardcoded terminal growth rates and exit multiples server-side
      });
      if (!presetsRes.ok) throw new Error(await presetsRes.text());
      const updated = await fetch(`${API}/assets/${symbol}/detail`).then(r => r.json());
      setDetail(updated);
      setValuationError(null);
      setShowForm(false);
    } catch (e: any) {
      setPresetsError(e.message ?? "Preset run failed");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Derived valuation data
  const scenarios      = detail?.valuationScenarios ?? [];
  const bearCase       = scenarios.find((s: any) => s.caseType === "BEAR" && s.modelType !== "PEG" && s.modelType !== "GRAHAM" && s.modelType !== "DDM");
  const baseCase       = scenarios.find((s: any) => s.caseType === "BASE" && s.modelType !== "PEG" && s.modelType !== "GRAHAM" && s.modelType !== "DDM");
  const bullCase       = scenarios.find((s: any) => s.caseType === "BULL" && s.modelType !== "PEG" && s.modelType !== "GRAHAM" && s.modelType !== "DDM");
  const pegScenario    = scenarios.find((s: any) => s.modelType === "PEG");
  const grahamScenario = scenarios.find((s: any) => s.modelType === "GRAHAM");
  const ddmScenario    = scenarios.find((s: any) => s.modelType === "DDM");
  const latestVal      = baseCase ?? scenarios.find((s: any) => s.modelType !== "PEG" && s.modelType !== "GRAHAM" && s.modelType !== "DDM") ?? scenarios[0];
  const buyBelow       = latestVal ? Number(latestVal.intrinsicValue) * (1 - targetMos / 100) : 0;
  const taxLots        = detail?.taxLots ?? [];
  const assetTx        = detail?.transactions ?? [];
  const holding        = detail?.holding;
  const avgCost        = holding ? Number(holding.averageCostBasis) : null;

  // IV reference lines — one entry per unique model+case scenario
  const IV_MODEL_COLORS: Record<string, string> = {
    DCF:            "#60a5fa",  // blue
    OWNER_EARNINGS: "#a78bfa",  // purple
    PEG:            "#34d399",  // teal
    GRAHAM:         "#fb923c",  // orange
    DDM:            "#f472b6",  // pink
    CRYPTO_RISK:    "#94a3b8",  // slate
    EPS_MULTIPLE:   "#facc15",  // yellow
  };
  const IV_CASE_DASH: Record<string, string> = {
    BASE: "none",
    BULL: "8 4",
    BEAR: "3 3",
  };
  const ivLines = (detail?.valuationScenarios ?? []).map((s: any) => ({
    key:   `${s.modelType}_${s.caseType}`,
    label: `${MODEL_LABELS_EXT[s.modelType] ?? s.modelType} · ${s.caseType}`,
    iv:    Number(s.intrinsicValue),
    color: IV_MODEL_COLORS[s.modelType] ?? "#94a3b8",
    dash:  IV_CASE_DASH[s.caseType]    ?? "6 3",
  })).filter((l: any) => l.iv > 0)
    // deduplicate by key, keep most recent (array is already desc by createdAt from backend)
    .filter((l: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.key === l.key) === i);

  const priceChartData = (() => {
    const all = prices.map((p: any) => ({ date: p.priceDate, close: Number(p.close) }));
    if (priceRange === "all" || all.length === 0) return all;
    const now = new Date();
    let cutoff: Date;
    if      (priceRange === "1w")  cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    else if (priceRange === "1m")  cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    else if (priceRange === "3m")  cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    else if (priceRange === "6m")  cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    else if (priceRange === "ytd") cutoff = new Date(now.getFullYear(), 0, 1);
    else if (priceRange === "5y")  cutoff = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    else                           cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // 1y
    return all.filter(p => new Date(p.date + "T00:00:00") >= cutoff);
  })();

  // Model comparison: latest scenario per model type
  const latestByModel: Record<string, any> = {};
  for (const s of scenarios) {
    if (!latestByModel[s.modelType]) latestByModel[s.modelType] = s;
  }

  const inputStyle: React.CSSProperties = {
    background: C.bg,
    color: C.text,
    border: `1px solid rgba(200,169,106,0.35)`,
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    fontFamily: C.font,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Research</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>
        Valuation Workspace
      </h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "40px", flexWrap: "wrap", gap: "12px" }}>
        <p style={{ color: C.muted, margin: 0 }}>
          Search any asset to analyse intrinsic value, position sizing, and tax efficiency.
        </p>
        <Nasdaq100SyncWidget />
      </div>

      {/* Search */}
      <section style={{ ...sectionStyle, marginBottom: "32px", position: "relative" }}>
        <p style={labelStyle}>Asset Search</p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search any asset by symbol or name (e.g. AMD, Apple, BTC)…"
          style={{ ...inputStyle, marginTop: "20px", fontSize: "16px", padding: "14px 16px" }}
        />
        {adding && (
          <p style={{ color: C.gold, fontSize: "13px", marginTop: "8px" }}>Adding to library…</p>
        )}
        {query.trim().length > 0 && (
          <div style={{ marginTop: "16px", borderTop: `1px solid ${C.borderSubtle}` }}>
            {results.length === 0
              ? <p style={{ color: C.muted, marginTop: "16px" }}>No results — try a different symbol or name.</p>
              : results.map((a: any) => (
                  <button key={a.symbol} onClick={() => selectSymbol(a.symbol, a.inLibrary)}
                    style={{ width: "100%", display: "grid", gridTemplateColumns: "100px 1fr 120px 80px",
                      gap: "16px", alignItems: "center", background: "transparent", color: C.text,
                      border: 0, borderBottom: `1px solid ${C.borderSubtle}`, padding: "14px 0",
                      cursor: "pointer", textAlign: "left", fontFamily: C.font }}>
                    <strong style={{ color: C.gold }}>{a.symbol}</strong>
                    <span style={{ fontSize: "14px" }}>{a.name}</span>
                    <span style={{ color: C.muted, fontSize: "12px" }}>{a.exchangeShortName ?? a.exchange ?? ""}</span>
                    <span style={{ textAlign: "right", fontSize: "11px",
                      color: a.inLibrary ? C.green : C.muted }}>
                      {a.inLibrary ? "In library" : "Add & open"}
                    </span>
                  </button>
                ))}
          </div>
        )}
      </section>

      {/* No symbol selected */}
      {!symbol && !adding && (
        <p style={{ color: C.muted, textAlign: "center", marginTop: "80px", fontSize: "18px" }}>
          Search for any asset above to begin your analysis.
        </p>
      )}

      {/* Loading */}
      {symbol && !detail && (
        <p style={{ color: C.gold, marginTop: "32px" }}>Loading {symbol}…</p>
      )}

      {/* Asset Detail */}
      {symbol && detail && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "32px" }}>
            <div>
              <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{detail.assetName}</p>
              <h1 style={{ fontSize: "56px", margin: "4px 0 0", lineHeight: 1 }}>{detail.symbol}</h1>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={syncFromFMP} disabled={syncing}
                  style={{ background: syncing ? "rgba(200,169,106,0.08)" : "rgba(200,169,106,0.15)",
                    color: C.gold, border: `1px solid rgba(200,169,106,0.4)`,
                    borderRadius: "999px", padding: "8px 18px", cursor: syncing ? "wait" : "pointer",
                    fontFamily: C.font, fontSize: "13px" }}>
                  {syncing ? "Syncing…" : "⟳ Sync"}
                </button>
                <button onClick={clearSymbol}
                  style={{ background: "transparent", color: C.muted, border: `1px solid ${C.borderSubtle}`,
                    borderRadius: "999px", padding: "8px 18px", cursor: "pointer", fontFamily: C.font, fontSize: "13px" }}>
                  ✕ Clear
                </button>
              </div>
              {syncMsg && <p style={{
                color: syncMsg.startsWith("Sync failed") ? C.red
                     : syncMsg.includes("no financial data") ? C.gold
                     : C.green,
                fontSize: "12px", margin: 0
              }}>{syncMsg}</p>}
            </div>
          </div>

          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "10px", marginBottom: "32px" }}>
            {[
              { label: "Position Value", value: holding ? `$${Number(holding.marketValue).toLocaleString("en-US",{minimumFractionDigits:2})}` : "Not held" },
              { label: "Unrealized Gain",
                value: holding ? `${Number(holding.unrealizedGain) >= 0 ? "+" : ""}${fmt$(Number(holding.unrealizedGain))}` : "—",
                color: holding ? (Number(holding.unrealizedGain) >= 0 ? C.green : C.red) : C.text,
                sub: holding ? `${Number(holding.unrealizedGainPercent) >= 0 ? "+" : ""}${Number(holding.unrealizedGainPercent).toFixed(2)}%` : undefined,
              },
              { label: "Current Price",  value: detail?.latestPrice != null ? `$${Number(detail.latestPrice).toLocaleString("en-US",{minimumFractionDigits:2})}` : "—" },
              { label: "PEG Ratio", value: pegScenario ? Number(pegScenario.intrinsicValue).toFixed(2) : "—",
                color: pegScenario ? (Number(pegScenario.intrinsicValue) < 1 ? C.green : Number(pegScenario.intrinsicValue) <= 2 ? C.gold : C.red) : C.text },
              { label: "Intrinsic Value", value: latestVal ? `$${Number(latestVal.intrinsicValue).toFixed(2)}` : "—" },
              { label: "Margin of Safety", value: latestVal ? `${Number(latestVal.marginOfSafetyPercent).toFixed(2)}%` : "—",
                color: latestVal ? (Number(latestVal.marginOfSafetyPercent) >= 20 ? C.green : Number(latestVal.marginOfSafetyPercent) >= 0 ? C.gold : C.red) : C.text },
            ].map(({ label, value, color, sub }: any) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "14px 16px" }}>
                <p style={{ color: C.muted, fontSize: "11px", margin: 0 }}>{label}</p>
                <h3 style={{ fontSize: "18px", marginTop: "8px", marginBottom: 0, color: color ?? C.text }}>{value}</h3>
                {sub && <p style={{ color: color ?? C.muted, fontSize: "12px", margin: "3px 0 0" }}>{sub}</p>}
              </div>
            ))}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ color: C.muted, fontSize: "11px", margin: 0 }}>Buy Below</p>
                <div style={{ display: "flex", alignItems: "center", gap: "3px", marginLeft: "auto" }}>
                  <input type="number" min={0} max={90} value={targetMos}
                    onChange={e => setTargetMos(Number(e.target.value))}
                    style={{ width: "40px", background: "transparent", color: C.gold,
                      border: `1px solid rgba(200,169,106,0.4)`, borderRadius: "6px",
                      padding: "2px 5px", fontFamily: C.font, fontSize: "11px",
                      textAlign: "center" }} />
                  <span style={{ color: C.muted, fontSize: "11px" }}>% MOS</span>
                </div>
              </div>
              <h3 style={{ fontSize: "18px", marginTop: "8px", marginBottom: 0, color: C.text }}>
                {latestVal ? `$${buyBelow.toFixed(2)}` : "—"}
              </h3>
            </div>
          </div>

          {/* Price History Chart */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <p style={labelStyle}>Price History</p>
                <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>
                  {symbol} — Historical Close Price
                  {avgCost && <span style={{ color: C.muted, fontSize: "14px", marginLeft: "16px" }}>
                    avg cost ${avgCost.toFixed(2)}
                  </span>}
                </h3>
              </div>
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                {PRICE_RANGES.map(r => (
                  <button key={r} onClick={() => setPriceRange(r)} style={{
                    background: priceRange === r ? C.gold : "transparent",
                    color: priceRange === r ? "#000" : C.muted,
                    border: `1px solid ${priceRange === r ? C.gold : C.border}`,
                    borderRadius: "8px", padding: "4px 10px", fontSize: "12px",
                    fontWeight: priceRange === r ? 700 : 400,
                    cursor: "pointer", textTransform: "uppercase",
                  }}>{r}</button>
                ))}
              </div>
            </div>

            {/* IV line toggles */}
            {ivLines.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <button onClick={() => setShowIVToggles(v => !v)} style={{
                  background: "none", border: `1px solid ${C.border}`, color: C.muted,
                  borderRadius: "8px", padding: "4px 12px", fontSize: "12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <span>Intrinsic Value Lines</span>
                  {activeIVLines.size > 0 && (
                    <span style={{ background: C.gold, color: "#000", borderRadius: "999px",
                      padding: "1px 7px", fontSize: "11px", fontWeight: 700 }}>
                      {activeIVLines.size}
                    </span>
                  )}
                  <span style={{ fontSize: "10px" }}>{showIVToggles ? "▲" : "▼"}</span>
                </button>
                {showIVToggles && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px", alignItems: "center" }}>
                    {ivLines.map((l: any) => {
                      const active = activeIVLines.has(l.key);
                      return (
                        <button key={l.key} onClick={() => {
                          setActiveIVLines(prev => {
                            const next = new Set(prev);
                            active ? next.delete(l.key) : next.add(l.key);
                            return next;
                          });
                        }} style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          padding: "4px 12px", borderRadius: "999px", fontSize: "12px", cursor: "pointer",
                          border: `1px solid ${active ? l.color : C.border}`,
                          background: active ? `${l.color}18` : "transparent",
                          color: active ? l.color : C.muted,
                          transition: "all 0.15s",
                        }}>
                          <svg width="20" height="10" style={{ flexShrink: 0 }}>
                            <line x1="0" y1="5" x2="20" y2="5"
                              stroke={active ? l.color : C.muted}
                              strokeWidth="2"
                              strokeDasharray={l.dash === "none" ? undefined : l.dash} />
                          </svg>
                          {l.label} · ${l.iv.toFixed(2)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {priceChartData.length === 0
              ? <p style={{ color: C.muted }}>No price data yet — click "Sync from FMP" to load history.</p>
              : <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={priceChartData}>
                    <CartesianGrid stroke="rgba(200,169,106,0.08)" vertical={false} />
                    <XAxis dataKey="date" stroke={C.muted} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={60} />
                    <YAxis stroke={C.muted} tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Close"]} />
                    {avgCost && (
                      <ReferenceLine y={avgCost} stroke={C.gold} strokeDasharray="6 3"
                        label={{ value: `Avg Cost $${avgCost.toFixed(2)}`, fill: C.gold, fontSize: 11, position: "insideTopRight" }} />
                    )}
                    {ivLines.filter((l: any) => activeIVLines.has(l.key)).map((l: any) => (
                      <ReferenceLine key={l.key} y={l.iv}
                        stroke={l.color}
                        strokeDasharray={l.dash === "none" ? undefined : l.dash}
                        strokeWidth={1.5}
                        label={{ value: `${l.label} $${l.iv.toFixed(2)}`, fill: l.color, fontSize: 10, position: "insideBottomRight" }} />
                    ))}
                    <Line type="monotone" dataKey="close" stroke={C.green} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </section>

          {/* Financial Metrics */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <p style={labelStyle}>Financials</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
              <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>
                Key Metrics ({finPeriod === "annual" ? "Annual" : "Quarterly"})
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                {/* Period toggle — hidden for dividend tab which has its own toggle */}
                {finTab !== "dividend" && (["annual","quarter"] as const).map(p => (
                  <button key={p} onClick={() => setFinPeriod(p)} style={{
                    padding: "8px 20px", borderRadius: "999px", cursor: "pointer",
                    fontFamily: C.font, fontSize: "13px",
                    background: finPeriod === p ? "rgba(200,169,106,0.15)" : "transparent",
                    color: finPeriod === p ? C.gold : C.muted,
                    border: finPeriod === p ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}`,
                  }}>{p === "annual" ? "Annual" : "Quarterly"}</button>
                ))}
                {finTab !== "dividend" && <div style={{ width: "1px", background: C.borderSubtle, margin: "0 4px" }} />}
                {/* Sub-tab toggle */}
                {(["profitability","growth","health","valuation","dividend"] as const).map(tab => (
                  <button key={tab} onClick={() => setFinTab(tab)} style={{
                    padding: "8px 20px", borderRadius: "999px", cursor: "pointer",
                    fontFamily: C.font, fontSize: "13px", textTransform: "capitalize",
                    background: finTab === tab ? "rgba(200,169,106,0.15)" : "transparent",
                    color: finTab === tab ? C.gold : C.muted,
                    border: finTab === tab ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}`,
                  }}>{tab}</button>
                ))}
              </div>
            </div>

            {/* ── Dividend tab ── */}
            {finTab === "dividend" && (() => {
              const [divPeriod, setDivPeriod] = [finPeriod, setFinPeriod];

              if (dividends.length === 0) {
                return <p style={{ color: C.muted }}>No dividend data available for this symbol.</p>;
              }

              // ── Annual aggregation ──────────────────────────────────────────
              const byYear: Record<string, number> = {};
              dividends.forEach((d: any) => {
                const year = String(d.date ?? "").slice(0, 4);
                if (year) byYear[year] = (byYear[year] ?? 0) + Number(d.adjDividend ?? 0);
              });
              const annualRows = Object.entries(byYear)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([year, dps]) => ({ year, dps: +dps.toFixed(4) }));

              // YoY growth
              const annualGrowth = annualRows.map((r, i) => {
                if (i === 0) return { year: r.year, growth: null };
                const prev = annualRows[i - 1].dps;
                return { year: r.year, growth: prev > 0 ? +((r.dps - prev) / prev * 100).toFixed(2) : null };
              });

              // Payout ratio — use detail.eps as annual EPS proxy
              const epsVal = detail?.eps ? Number(detail.eps) : null;
              const annualWithPayout = annualRows.map(r => ({
                ...r,
                payout: epsVal && epsVal > 0 ? +((r.dps / epsVal) * 100).toFixed(1) : null,
              }));

              // ── Quarterly rows ──────────────────────────────────────────────
              const quarterlyRows = [...dividends]
                .sort((a: any, b: any) => (a.date ?? "").localeCompare(b.date ?? ""))
                .map((d: any) => {
                  const dt = d.date ?? "";
                  const [year, month] = dt.split("-");
                  const m = parseInt(month ?? "1", 10);
                  const q = m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
                  return { label: `${q} '${(year ?? "").slice(2)}`, dps: Number(d.adjDividend ?? 0), date: dt };
                })
                .slice(-20); // last 20 quarters ≈ 5 years

              const isAnnual = finPeriod === "annual";
              const chartData  = isAnnual ? annualWithPayout : quarterlyRows;
              const growthData = isAnnual ? annualGrowth.filter(r => r.growth !== null) : [];
              const xKey = isAnnual ? "year" : "label";

              const lastRow = annualRows[annualRows.length - 1];
              const prevRow = annualRows[annualRows.length - 2];
              const ttmDps  = lastRow?.dps ?? 0;
              const yoyGrowth = prevRow && prevRow.dps > 0
                ? ((ttmDps - prevRow.dps) / prevRow.dps * 100).toFixed(1)
                : null;
              const payoutPct = epsVal && epsVal > 0 && ttmDps > 0
                ? ((ttmDps / epsVal) * 100).toFixed(1)
                : null;

              return (
                <div>
                  {/* Period toggle */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
                    {(["annual","quarter"] as const).map(p => (
                      <button key={p} onClick={() => setDivPeriod(p)} style={{
                        padding: "8px 20px", borderRadius: "999px", cursor: "pointer",
                        fontFamily: C.font, fontSize: "13px",
                        background: finPeriod === p ? "rgba(200,169,106,0.15)" : "transparent",
                        color: finPeriod === p ? C.gold : C.muted,
                        border: finPeriod === p ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}`,
                      }}>{p === "annual" ? "Annual" : "Quarterly"}</button>
                    ))}
                    {/* Summary chips */}
                    <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
                      <span style={{ color: C.muted, fontSize: "13px" }}>
                        Latest annual DPS: <strong style={{ color: C.text }}>${ttmDps.toFixed(2)}</strong>
                      </span>
                      {yoyGrowth && (
                        <span style={{ color: C.muted, fontSize: "13px" }}>
                          YoY growth: <strong style={{ color: Number(yoyGrowth) >= 0 ? C.green : C.red }}>{yoyGrowth}%</strong>
                        </span>
                      )}
                      {payoutPct && (
                        <span style={{ color: C.muted, fontSize: "13px" }}>
                          Payout ratio: <strong style={{ color: Number(payoutPct) > 80 ? C.red : Number(payoutPct) > 60 ? C.gold : C.green }}>{payoutPct}%</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: growthData.length > 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: "32px" }}>
                    {/* Chart 1: DPS */}
                    <div>
                      <p style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                        {isAnnual ? "Annual Dividend / Share" : "Quarterly Dividend / Share"}
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} barSize={isAnnual ? 24 : 14}>
                          <CartesianGrid stroke="rgba(200,169,106,0.06)" vertical={false} />
                          <XAxis dataKey={xKey} stroke={C.muted} tick={{ fontSize: 11 }} interval={isAnnual ? 0 : "preserveStartEnd"} minTickGap={isAnnual ? 0 : 30} />
                          <YAxis stroke={C.muted} tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} width={44} />
                          <Tooltip
                            contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: C.font }}
                            labelStyle={{ color: C.muted, fontSize: "12px" }}
                            itemStyle={{ color: C.text }}
                            formatter={(v: any) => [`$${Number(v).toFixed(4)}`, "DPS"]}
                          />
                          <Bar dataKey="dps" radius={[4,4,0,0]}>
                            {chartData.map((_: any, i: number) => (
                              <Cell key={i} fill={i === chartData.length - 1 ? C.gold : "rgba(200,169,106,0.45)"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart 2: YoY growth (annual only) */}
                    {isAnnual && growthData.length > 0 && (
                      <div>
                        <p style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                          Dividend Growth YoY %
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={growthData} barSize={24}>
                            <CartesianGrid stroke="rgba(200,169,106,0.06)" vertical={false} />
                            <XAxis dataKey="year" stroke={C.muted} tick={{ fontSize: 11 }} />
                            <YAxis stroke={C.muted} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} width={44} />
                            <Tooltip
                              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: C.font }}
                              labelStyle={{ color: C.muted, fontSize: "12px" }}
                              itemStyle={{ color: C.text }}
                              formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "YoY Growth"]}
                            />
                            <Bar dataKey="growth" radius={[4,4,0,0]}>
                              {growthData.map((r: any, i: number) => (
                                <Cell key={i} fill={r.growth >= 0 ? C.green : C.red} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Chart 3: Payout ratio (annual only, needs EPS) */}
                    {isAnnual && epsVal && annualWithPayout.some((r: any) => r.payout != null) && (
                      <div>
                        <p style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                          Payout Ratio % (Dividends / EPS)
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={annualWithPayout.filter((r: any) => r.payout != null)} barSize={24}>
                            <CartesianGrid stroke="rgba(200,169,106,0.06)" vertical={false} />
                            <XAxis dataKey="year" stroke={C.muted} tick={{ fontSize: 11 }} />
                            <YAxis stroke={C.muted} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} width={44} />
                            <Tooltip
                              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: C.font }}
                              labelStyle={{ color: C.muted, fontSize: "12px" }}
                              itemStyle={{ color: C.text }}
                              formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Payout Ratio"]}
                            />
                            <Bar dataKey="payout" radius={[4,4,0,0]}>
                              {annualWithPayout.filter((r: any) => r.payout != null).map((r: any, i: number) => (
                                <Cell key={i} fill={r.payout > 80 ? C.red : r.payout > 60 ? C.gold : C.green} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p style={{ color: C.muted, fontSize: "11px", marginTop: "6px" }}>
                          {"< 60% sustainable · 60–80% watch · > 80% at risk"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Other financial tabs ── */}
            {finTab !== "dividend" && financials.annual.length === 0
              ? <p style={{ color: C.muted }}>No financial data yet — click ⟳ Sync to load.</p>
              : finTab !== "dividend" && (() => {
                  const activeRows = finPeriod === "annual"
                    ? [...financials.annual].reverse()
                    : [...financials.quarterly].reverse();

                  const rows = activeRows;

                  // Annual: "2024", Quarterly: "Q1 '24"
                  const fmt = (d: string) => {
                    if (!d) return "";
                    if (finPeriod === "annual") return d.slice(0, 4);
                    // FMP quarterly date format: "2024-03-30" — derive quarter from month
                    const [year, month] = d.split("-");
                    const m = parseInt(month, 10);
                    const q = m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
                    return `${q} '${year.slice(2)}`;
                  };
                  const bil = (v: number) => v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v}`;

                  const barColor = (data: any[], key: string) => {
                    if (data.length < 2) return () => C.gold;
                    const first = Number(data[0]?.[key] ?? 0);
                    const last  = Number(data[data.length - 1]?.[key] ?? 0);
                    const trend = last >= first ? C.green : C.red;
                    return (_: any, i: number) => i === data.length - 1 ? trend : "rgba(200,169,106,0.4)";
                  };

                  const MetricChart = ({ title, dataKey, data, formatter, unit = "" }: any) => {
                    const colorFn = barColor(data, dataKey);
                    return (
                      <div>
                        <p style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>{title}</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={data} barSize={20}>
                            <CartesianGrid stroke="rgba(200,169,106,0.06)" vertical={false} />
                            <XAxis dataKey="year" stroke={C.muted} tick={{ fontSize: 11 }} />
                            <YAxis stroke={C.muted} tick={{ fontSize: 10 }} tickFormatter={formatter} width={48} />
                            <Tooltip
                              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: C.font }}
                              labelStyle={{ color: C.muted, fontSize: "12px" }}
                              itemStyle={{ color: C.text }}
                              formatter={(v: any) => [formatter(Number(v)) + unit, title]}
                            />
                            <Bar dataKey={dataKey} radius={[4,4,0,0]}>
                              {data.map((_: any, i: number) => <Cell key={i} fill={colorFn(_, i)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  };

                  const allMapped = rows.map(r => ({
                    year:      fmt(r.date),
                    eps:       r.epsDiluted != null ? Number(r.epsDiluted) : null,
                    margin:    r.netMarginPct != null ? Number(r.netMarginPct) : null,
                    roe:       r.roePct != null ? Number(r.roePct) : null,
                    roic:      r.roicPct != null ? Number(r.roicPct) : null,
                    revenue:   r.revenue != null ? Number(r.revenue) : null,
                    netIncome: r.netIncome != null ? Number(r.netIncome) : null,
                    ocf:       r.operatingCashFlow != null ? Number(r.operatingCashFlow) : null,
                    fcf:       r.freeCashFlow != null ? Number(r.freeCashFlow) : null,
                    debt:      r.totalDebt != null ? Number(r.totalDebt) : null,
                    cash:      r.cash != null ? Number(r.cash) : null,
                    de:        r.debtToEquity != null ? Number(r.debtToEquity) : null,
                    cr:        r.currentRatio != null ? Number(r.currentRatio) : null,
                    pe:        r.peRatio != null ? Number(r.peRatio) : null,
                    pb:        r.pbRatio != null ? Number(r.pbRatio) : null,
                    ps:        r.psRatio != null ? Number(r.psRatio) : null,
                    evEbitda:  r.evToEbitda != null ? Number(r.evToEbitda) : null,
                  }));

                  // Deduplicate by year label — if two fiscal dates map to the same quarter
                  // label (e.g. two FMP entries for "2023-09-30"), keep only the first (newest).
                  const seenYears = new Set<string>();
                  const mapped = allMapped.filter(r => {
                    if (seenYears.has(r.year)) return false;
                    seenYears.add(r.year);
                    return true;
                  });

                  const charts: Record<string, any[]> = {
                    profitability: [
                      { title: "EPS (Diluted)",    dataKey: "eps",    formatter: (v: number) => `$${v.toFixed(2)}` },
                      { title: "Net Margin %",     dataKey: "margin", formatter: (v: number) => `${v.toFixed(1)}%` },
                      { title: "Return on Equity", dataKey: "roe",    formatter: (v: number) => `${v.toFixed(1)}%` },
                      { title: "ROIC",             dataKey: "roic",   formatter: (v: number) => `${v.toFixed(1)}%` },
                    ],
                    growth: [
                      { title: "Revenue",              dataKey: "revenue",    formatter: bil },
                      { title: "Net Income",           dataKey: "netIncome",  formatter: bil },
                      { title: "Operating Cash Flow",  dataKey: "ocf",        formatter: bil },
                      { title: "Free Cash Flow",       dataKey: "fcf",        formatter: bil },
                    ],
                    health: [
                      { title: "Total Debt",     dataKey: "debt", formatter: bil },
                      { title: "Cash & Equiv.",  dataKey: "cash", formatter: bil },
                      { title: "Debt / Equity",  dataKey: "de",   formatter: (v: number) => `${v.toFixed(2)}x` },
                      { title: "Current Ratio",  dataKey: "cr",   formatter: (v: number) => `${v.toFixed(2)}x` },
                    ],
                    valuation: [
                      { title: "P/E Ratio",    dataKey: "pe",      formatter: (v: number) => `${v.toFixed(1)}x` },
                      { title: "P/B Ratio",    dataKey: "pb",      formatter: (v: number) => `${v.toFixed(1)}x` },
                      { title: "P/S Ratio",    dataKey: "ps",      formatter: (v: number) => `${v.toFixed(1)}x` },
                      { title: "EV / EBITDA",  dataKey: "evEbitda",formatter: (v: number) => `${v.toFixed(1)}x` },
                    ],
                  };

                  const activeCharts = charts[finTab as keyof typeof charts];
                  if (rows.length === 0 || !activeCharts) {
                    return <p style={{ color: C.muted }}>No quarterly data — click ⟳ Sync to load.</p>;
                  }

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                      {activeCharts.map((c: any) => (
                        <MetricChart key={c.dataKey} {...c} data={mapped} />
                      ))}
                    </div>
                  );
                })()
            }
          </section>

          {/* Valuation Range */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={labelStyle}>Intrinsic Value</p>
                <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>Valuation Range</h3>
              </div>
              <div />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px", marginTop: "28px" }}>
              {[["Bear Case", bearCase], ["Base Case", baseCase], ["Bull Case", bullCase]].map(([label, sc]: any) => (
                <div key={label} style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px" }}>
                  <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
                  {/* Primary DCF value */}
                  <div style={{ marginTop: "12px" }}>
                    <p style={{ color: C.muted, fontSize: "11px", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{sc ? (MODEL_LABELS[sc.modelType as Model] ?? sc.modelType) : "—"}</p>
                    <h4 style={{ fontSize: "28px", margin: "4px 0 0", color: sc ? C.text : C.muted }}>
                      {sc ? `$${Number(sc.intrinsicValue).toFixed(2)}` : "—"}
                    </h4>
                  </div>
                  {/* Cross-check exit multiple value */}
                  {sc?.exitMultipleValue != null && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ color: C.muted, fontSize: "11px", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Cross-check ({sc.exitMultiple}x exit)
                      </p>
                      <p style={{ fontSize: "18px", margin: "4px 0 0", color: C.muted }}>
                        ${Number(sc.exitMultipleValue).toFixed(2)}
                      </p>
                    </div>
                  )}
                  <p style={{ color: sc && Number(sc.marginOfSafetyPercent) >= 20 ? C.green : sc && Number(sc.marginOfSafetyPercent) >= 0 ? C.gold : C.red, marginTop: "10px", fontSize: "14px" }}>
                    {sc ? `MOS ${Number(sc.marginOfSafetyPercent).toFixed(1)}%` : ""}
                  </p>
                  <p style={{ color: C.muted, marginTop: "8px", fontSize: "13px" }}>
                    {sc ? `Buy below $${(Number(sc.intrinsicValue) * (1 - targetMos / 100)).toFixed(2)}` : ""}
                  </p>
                  <p style={{ color: C.muted, marginTop: "8px", fontSize: "12px" }}>
                    {sc ? `g=${sc.growthRatePercent}% · d=${sc.discountRatePercent}% · gT=${sc.terminalGrowthRatePercent ?? "—"}%` : ""}
                  </p>
                </div>
              ))}
            </div>

            {/* PEG Ratio card */}
            {pegScenario && (() => {
              const ratio = Number(pegScenario.intrinsicValue);
              const ratioColor = ratio < 1 ? C.green : ratio <= 2 ? C.gold : C.red;
              const ratioLabel = ratio < 1 ? "Undervalued vs growth" : ratio <= 2 ? "Fairly valued vs growth" : "Overvalued vs growth";
              return (
                <div style={{ marginTop: "20px", border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px",
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "center" }}>
                  <div>
                    <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>PEG Ratio (Peter Lynch)</p>
                    <h3 style={{ fontSize: "42px", margin: "8px 0 4px", color: ratioColor }}>{ratio.toFixed(2)}</h3>
                    <p style={{ color: ratioColor, fontSize: "13px", margin: 0 }}>{ratioLabel}</p>
                  </div>
                  <div style={{ fontSize: "13px", color: C.muted, lineHeight: "1.8" }}>
                    <p style={{ margin: 0 }}>P/E ÷ EPS Growth Rate</p>
                    <p style={{ margin: "4px 0 0" }}>P/E: {Number(pegScenario.earningsPerShare) !== 0 ? `${(Number(pegScenario.currentPrice) / Number(pegScenario.earningsPerShare)).toFixed(1)}x` : "—"}</p>
                    <p style={{ margin: "4px 0 0" }}>Growth: {pegScenario.growthRatePercent}%</p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px" }}>{"< 1 undervalued · 1–2 fair · > 2 overvalued"}</p>
                  </div>
                </div>
              );
            })()}

            {/* Graham Number card */}
            {grahamScenario && (() => {
              const iv    = Number(grahamScenario.intrinsicValue);
              const price = Number(grahamScenario.currentPrice);
              const mos   = Number(grahamScenario.marginOfSafetyPercent);
              const mosColor = mos >= 20 ? C.green : mos >= 0 ? C.gold : C.red;
              const mosLabel = mos >= 20 ? "Trading below Graham Number" : mos >= 0 ? "Near Graham Number" : "Trading above Graham Number";
              return (
                <div style={{ marginTop: "20px", border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px",
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "center" }}>
                  <div>
                    <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>Graham Number</p>
                    <h3 style={{ fontSize: "42px", margin: "8px 0 4px", color: C.text }}>${iv.toFixed(2)}</h3>
                    <p style={{ color: mosColor, fontSize: "13px", margin: 0 }}>{mosLabel} · MOS {mos.toFixed(1)}%</p>
                  </div>
                  <div style={{ fontSize: "13px", color: C.muted, lineHeight: "1.8" }}>
                    <p style={{ margin: 0 }}>√(22.5 × EPS × Book Value/Share)</p>
                    <p style={{ margin: "4px 0 0" }}>EPS: ${Number(grahamScenario.earningsPerShare).toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0" }}>Current price: ${price.toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px" }}>Best for asset-heavy companies</p>
                  </div>
                </div>
              );
            })()}

            {/* DDM card */}
            {ddmScenario && (() => {
              const iv    = Number(ddmScenario.intrinsicValue);
              const price = Number(ddmScenario.currentPrice);
              const mos   = Number(ddmScenario.marginOfSafetyPercent);
              const mosColor = mos >= 20 ? C.green : mos >= 0 ? C.gold : C.red;
              const mosLabel = mos >= 20 ? "Trading below DDM value" : mos >= 0 ? "Near DDM value" : "Trading above DDM value";
              return (
                <div style={{ marginTop: "20px", border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px",
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "center" }}>
                  <div>
                    <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>DDM Intrinsic Value</p>
                    <h3 style={{ fontSize: "42px", margin: "8px 0 4px", color: C.text }}>${iv.toFixed(2)}</h3>
                    <p style={{ color: mosColor, fontSize: "13px", margin: 0 }}>{mosLabel} · MOS {mos.toFixed(1)}%</p>
                  </div>
                  <div style={{ fontSize: "13px", color: C.muted, lineHeight: "1.8" }}>
                    <p style={{ margin: 0 }}>D₁ / (r − g)</p>
                    <p style={{ margin: "4px 0 0" }}>Dividend/Share (D₀): ${Number(ddmScenario.earningsPerShare).toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0" }}>Growth: {ddmScenario.growthRatePercent}% · Discount: {ddmScenario.discountRatePercent}%</p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px" }}>Only reliable for dividend-paying stocks</p>
                  </div>
                </div>
              );
            })()}

            {/* Fair Value Range bar */}
            {bearCase && bullCase && (() => {
              const lo  = Number(bearCase.intrinsicValue);
              const hi  = Number(bullCase.intrinsicValue);
              const cur = Number(detail?.latestPrice ?? detail?.holding?.marketPrice ?? bearCase.currentPrice ?? 0);
              if (!lo || !hi || lo >= hi) return null;

              const clampPct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
              const markerPct = clampPct(cur);
              const markerColor = cur < lo ? C.green : cur > hi ? C.red : C.gold;
              const rangeLabel  = cur < lo ? "Trading below fair value range" : cur > hi ? "Trading above fair value range" : "Trading within fair value range";

              return (
                <div style={{ marginTop: "28px", padding: "20px 24px", border: `1px solid ${C.borderSubtle}`, borderRadius: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <p style={{ color: C.muted, fontSize: "12px", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fair Value Range</p>
                    <p style={{ color: markerColor, fontSize: "12px", margin: 0 }}>{rangeLabel}</p>
                  </div>
                  <div style={{ position: "relative", height: "8px", borderRadius: "4px", background: "rgba(200,169,106,0.15)" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: "4px",
                      background: `linear-gradient(to right, ${C.green}, ${C.gold}, ${C.red})`, opacity: 0.35 }} />
                    {/* Current price marker */}
                    <div style={{ position: "absolute", top: "50%", left: `${markerPct}%`,
                      transform: "translate(-50%, -50%)", width: "14px", height: "14px",
                      borderRadius: "50%", background: markerColor, border: `2px solid ${C.bg}` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                    <span style={{ color: C.muted, fontSize: "12px" }}>${lo.toFixed(0)} bear</span>
                    <span style={{ color: markerColor, fontSize: "13px", fontWeight: 600 }}>
                      ${cur.toFixed(2)} current
                    </span>
                    <span style={{ color: C.muted, fontSize: "12px" }}>bull ${hi.toFixed(0)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Run Valuation */}
            <div style={{ marginTop: "28px", borderTop: `1px solid ${C.borderSubtle}`, paddingTop: "24px" }}>
              <button onClick={() => setShowForm(v => !v)}
                style={{ background: "rgba(200,169,106,0.1)", color: C.gold, border: `1px solid rgba(200,169,106,0.35)`,
                  borderRadius: "10px", padding: "10px 20px", cursor: "pointer", fontFamily: C.font, fontSize: "14px" }}>
                {showForm ? "▲ Hide Form" : "▼ Run New Valuation"}
              </button>

              {showForm && (
                <div style={{ marginTop: "24px" }}>
                  {/* Model selector */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
                    {MODELS.map(m => (
                      <button key={m} onClick={() => setModel(m)}
                        style={{ padding: "8px 16px", borderRadius: "999px", cursor: "pointer", fontFamily: C.font, fontSize: "13px",
                          background: model === m ? "rgba(200,169,106,0.15)" : "transparent",
                          color: model === m ? C.gold : C.muted,
                          border: model === m ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}` }}>
                        {MODEL_LABELS[m]}
                      </button>
                    ))}
                  </div>

                  {(model === "DCF" || model === "OWNER_EARNINGS") && (
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
                      <span style={{ color: C.muted, fontSize: "12px", marginRight: "4px" }}>Quick fill:</span>
                      {[
                        { label: "Conservative", g: "4",  d: "11", gT: "1.5", ex: "14" },
                        { label: "Moderate",     g: "8",  d: "10", gT: "2.5", ex: "20" },
                        { label: "Aggressive",   g: "12", d: "9",  gT: "3.5", ex: "26" },
                      ].map(p => (
                        <button key={p.label} onClick={() => setFormVals(v => ({
                          ...v,
                          growthRatePercent:         p.g,
                          discountRatePercent:       p.d,
                          terminalGrowthRatePercent: p.gT,
                          exitMultiple:              p.ex,
                        }))}
                          style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
                            borderRadius: "6px", padding: "4px 10px", cursor: "pointer",
                            fontFamily: C.font, fontSize: "12px" }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const isDcfModel = model === "DCF" || model === "OWNER_EARNINGS";
                    const growthLabel = model === "DCF" ? "EPS Growth Rate (%)"
                                      : model === "OWNER_EARNINGS" ? "FCF Growth Rate (%)"
                                      : "Growth Rate (%)";
                    const fields = [
                      { key: "currentPrice",              label: "Current Price ($)",                        show: true },
                      { key: "earningsPerShare",           label: "EPS ($)",                                  show: model !== "OWNER_EARNINGS" && model !== "GRAHAM" && model !== "DDM" },
                      { key: "freeCashFlowPerShare",       label: "FCF per Share ($)",                        show: model === "OWNER_EARNINGS" },
                      { key: "bookValuePerShare",          label: "Book Value per Share ($)",                 show: model === "GRAHAM" },
                      { key: "dividendPerShare",           label: "Annual Dividend per Share ($)",            show: model === "DDM" },
                      { key: "growthRatePercent",          label: growthLabel,                                show: model !== "PEG" && model !== "GRAHAM" },
                      { key: "discountRatePercent",        label: "Required Return / Discount Rate (%)",     show: model !== "PEG" && model !== "GRAHAM" },
                      { key: "years",                      label: "Years",                                    show: isDcfModel },
                      { key: "terminalGrowthRatePercent",  label: "Terminal Growth Rate (%) — perpetuity",   show: isDcfModel },
                      { key: "exitMultiple",               label: "Exit Multiple — cross-check (optional)",  show: isDcfModel },
                    ];
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
                        {fields.filter(f => f.show).map(({ key, label }) => (
                          <div key={key}>
                            <p style={{ color: C.muted, fontSize: "12px", marginBottom: "6px" }}>{label}</p>
                            <input type="number"
                              value={formVals[key as keyof typeof formVals]}
                              onChange={e => setFormVals(v => ({ ...v, [key]: e.target.value }))}
                              style={inputStyle} />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {(model === "DCF" || model === "OWNER_EARNINGS") && (
                    <p style={{ color: C.muted, fontSize: "11px", marginTop: "8px" }}>
                      {model === "OWNER_EARNINGS"
                        ? "Uses FCF/share as base — strips non-cash distortions. Terminal growth rate = long-run perpetuity growth (anchor to GDP: 2–4%)."
                        : "Terminal growth rate = long-run perpetuity growth assumed forever after year N (anchor to GDP: 2–4%). Exit multiple is an optional cross-check."}
                    </p>
                  )}
                  {model === "GRAHAM" && (
                    <p style={{ color: C.muted, fontSize: "11px", marginTop: "8px" }}>
                      Graham Number = √(22.5 × EPS × BVPS). Reliable for asset-heavy companies (banks, industrials). Sync to auto-fill EPS and Book Value/Share.
                    </p>
                  )}
                  {model === "DDM" && (
                    <p style={{ color: C.muted, fontSize: "11px", marginTop: "8px" }}>
                      DDM = D₁ / (r − g). Only meaningful for dividend-paying stocks. Discount rate must exceed growth rate. Sync to auto-fill annual dividend/share.
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                    <button onClick={handleRunValuation} disabled={submitting}
                      style={{ background: C.gold, color: C.bg, border: "none", borderRadius: "10px",
                        padding: "12px 24px", cursor: "pointer", fontFamily: C.font, fontSize: "14px", fontWeight: 700 }}>
                      {submitting ? "Running…" : "Run Single Scenario"}
                    </button>
                    {model !== "PEG" && model !== "GRAHAM" && model !== "DDM" && <div style={{ position: "relative", display: "inline-block" }}
                      onMouseEnter={e => (e.currentTarget.querySelector(".preset-tooltip") as HTMLElement)!.style.display = "block"}
                      onMouseLeave={e => (e.currentTarget.querySelector(".preset-tooltip") as HTMLElement)!.style.display = "none"}>
                      <button onClick={handleRunPresets} disabled={submitting}
                        style={{ background: "transparent", color: C.gold, border: `1px solid ${C.gold}`,
                          borderRadius: "10px", padding: "12px 24px", cursor: "pointer", fontFamily: C.font, fontSize: "14px" }}>
                        Run Bear / Base / Bull Presets
                      </button>
                      <div className="preset-tooltip" style={{
                        display: "none", position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
                        transform: "translateX(-50%)", background: C.card, border: `1px solid ${C.border}`,
                        borderRadius: "10px", padding: "14px 16px", zIndex: 100, whiteSpace: "nowrap",
                        fontFamily: C.font, fontSize: "12px", color: C.text, boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
                      }}>
                        <div style={{ marginBottom: "8px", color: C.muted, fontWeight: 600, letterSpacing: "0.05em", fontSize: "11px" }}>
                          PRESET ASSUMPTIONS ({model === "OWNER_EARNINGS" ? "FCF/share" : "EPS"}-based, 10 yrs)
                        </div>
                        <table style={{ borderCollapse: "collapse", width: "100%" }}>
                          <thead>
                            <tr style={{ color: C.muted, fontSize: "11px" }}>
                              <th style={{ textAlign: "left",  paddingRight: "16px" }}></th>
                              <th style={{ textAlign: "right", paddingRight: "12px" }}>Growth</th>
                              <th style={{ textAlign: "right", paddingRight: "12px" }}>Discount</th>
                              <th style={{ textAlign: "right", paddingRight: "12px" }}>Term. Growth</th>
                              <th style={{ textAlign: "right" }}>Exit ×</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: "Bear", color: "#ef4444", g: "4%", d: "11%", gT: "1.5%", ex: "14×" },
                              { label: "Base", color: C.gold,    g: "8%", d: "10%", gT: "2.5%", ex: "20×" },
                              { label: "Bull", color: "#22c55e", g: "12%", d: "9%",  gT: "3.5%", ex: "26×" },
                            ].map(row => (
                              <tr key={row.label}>
                                <td style={{ paddingRight: "16px", paddingTop: "4px", fontWeight: 700, color: row.color }}>{row.label}</td>
                                <td style={{ textAlign: "right", paddingRight: "12px", paddingTop: "4px" }}>{row.g}</td>
                                <td style={{ textAlign: "right", paddingRight: "12px", paddingTop: "4px" }}>{row.d}</td>
                                <td style={{ textAlign: "right", paddingRight: "12px", paddingTop: "4px" }}>{row.gT}</td>
                                <td style={{ textAlign: "right", paddingTop: "4px" }}>{row.ex}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: "8px", color: C.muted, fontSize: "11px" }}>
                          Price & EPS/FCF taken from your inputs above.
                        </div>
                      </div>
                    </div>}
                  </div>
                  {valuationError && (
                    <p style={{ color: C.red, fontSize: "13px", marginTop: "12px" }}>{valuationError}</p>
                  )}
                  {presetsError && (
                    <p style={{ color: C.red, fontSize: "13px", marginTop: "12px" }}>{presetsError}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* DCA Intelligence */}
          {(() => {
            const holding       = detail?.holding;
            const currentPrice  = Number(detail?.latestPrice ?? holding?.marketPrice ?? 0);
            const qtyHeld       = Number(holding?.quantityHeld ?? 0);
            const costBasis     = Number(holding?.totalCostBasis ?? 0);
            const avgCost       = Number(holding?.averageCostBasis ?? 0);

            // Best valuation scenario (highest IV from most-recent base, or first)
            const scenarios: any[] = detail?.valuationScenarios ?? [];
            const dcaScenarios = scenarios.filter((s: any) => s.modelType !== "PEG" && s.modelType !== "GRAHAM");
            const bestScenario = dcaScenarios.find((s: any) => s.caseType === "BASE") ?? dcaScenarios[0] ?? null;
            const intrinsicValue = bestScenario ? Number(bestScenario.intrinsicValue) : null;

            // Average Down Calculator
            const addAmt       = Math.max(0, Number(dcaAddAmount) || 0);
            const boughtShares = currentPrice > 0 ? addAmt / currentPrice : 0;
            const newQty       = qtyHeld + boughtShares;
            const newCostBasis = costBasis + addAmt;
            const newAvgCost   = newQty > 0 ? newCostBasis / newQty : 0;
            const newUnrealPnl = currentPrice > 0 ? (currentPrice - newAvgCost) * newQty : 0;
            const newUnrealPct = newAvgCost > 0 ? ((currentPrice - newAvgCost) / newAvgCost) * 100 : 0;
            const avgCostDelta = newAvgCost - avgCost;

            // Entry Price Targets (from intrinsic value)
            const targets = intrinsicValue
              ? [
                  { mos: 10, price: intrinsicValue * 0.90 },
                  { mos: 20, price: intrinsicValue * 0.80 },
                  { mos: 30, price: intrinsicValue * 0.70 },
                  { mos: 40, price: intrinsicValue * 0.60 },
                ]
              : [];

            return (
              <section style={{ ...sectionStyle, marginBottom: "32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
                  <div>
                    <p style={labelStyle}>DCA Intelligence</p>
                    <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>Add to Position</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <label style={{ color: C.muted, fontSize: "13px" }}>Available Cash ($)</label>
                    <input
                      type="number" value={dcaCash}
                      onChange={e => setDcaCash(e.target.value)}
                      onBlur={e => refreshDCA(e.target.value)}
                      style={{ width: "100px", background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
                        borderRadius: "8px", padding: "6px 10px", fontFamily: C.font }} />
                  </div>
                </div>

                {dcaLoading
                  ? <p style={{ color: C.gold, fontSize: "13px" }}>Loading recommendation…</p>
                  : !dcaRec
                  ? <p style={{ color: C.muted }}>Run a valuation scenario first to unlock DCA recommendations.</p>
                  : <>
                      {/* ── Recommendation card ── */}
                      {(() => {
                        const rec = dcaRec;
                        const actionColor = rec.action === "BUY_MORE" ? C.green : rec.action === "REDUCE" ? C.red : C.gold;
                        return (
                          <div style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "28px", marginBottom: "24px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                                  <span style={{ padding: "5px 18px", borderRadius: "999px", fontSize: "13px", fontWeight: 700,
                                    background: rec.action === "BUY_MORE" ? "rgba(143,214,148,0.12)" : rec.action === "REDUCE" ? "rgba(224,108,117,0.12)" : "rgba(200,169,106,0.12)",
                                    color: actionColor }}>
                                    {rec.action.replaceAll("_", " ")}
                                  </span>
                                  <span style={{ color: C.muted, fontSize: "13px" }}>{rec.confidenceScore}% confidence</span>
                                </div>
                                {rec.action === "BUY_MORE" && (
                                  <p style={{ color: C.text, fontSize: "28px", fontWeight: 600, margin: "0 0 4px" }}>
                                    ${Number(rec.suggestedAmount).toFixed(2)}
                                    <span style={{ color: C.muted, fontSize: "15px", fontWeight: 400, marginLeft: "10px" }}>
                                      ≈ {Number(rec.suggestedQuantity).toFixed(4)} shares
                                    </span>
                                  </p>
                                )}
                                <p style={{ color: C.muted, fontSize: "14px", lineHeight: "1.6", margin: "8px 0 0" }}>
                                  {rec.rationale}
                                </p>
                              </div>
                              {/* Confidence ring */}
                              <div style={{ textAlign: "center", minWidth: "64px" }}>
                                <svg width="64" height="64" viewBox="0 0 64 64">
                                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(200,169,106,0.1)" strokeWidth="6" />
                                  <circle cx="32" cy="32" r="26" fill="none" stroke={actionColor} strokeWidth="6"
                                    strokeDasharray={`${2 * Math.PI * 26 * rec.confidenceScore / 100} ${2 * Math.PI * 26}`}
                                    strokeLinecap="round" transform="rotate(-90 32 32)" />
                                </svg>
                                <p style={{ color: C.muted, fontSize: "11px", margin: "-4px 0 0" }}>{rec.confidenceScore}%</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Two-column: Avg Down Calculator + Entry Targets ── */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

                        {/* Average Down Calculator */}
                        <div style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px" }}>
                          <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Average Down Calculator
                          </p>
                          <p style={{ color: C.text, fontSize: "13px", margin: "0 0 18px", lineHeight: "1.5" }}>
                            If you buy more now, what happens to your position?
                          </p>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                            <label style={{ color: C.muted, fontSize: "13px", whiteSpace: "nowrap" }}>Add ($)</label>
                            <input
                              type="number" value={dcaAddAmount}
                              onChange={e => setDcaAddAmount(e.target.value)}
                              style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
                                borderRadius: "8px", padding: "6px 10px", fontFamily: C.font }} />
                          </div>

                          {qtyHeld > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                              {[
                                { label: "New Avg Cost",     val: newAvgCost > 0 ? `$${newAvgCost.toFixed(2)}` : "—",
                                  sub: avgCostDelta !== 0 ? `${avgCostDelta > 0 ? "+" : ""}$${avgCostDelta.toFixed(2)} vs now` : "no change",
                                  color: avgCostDelta < 0 ? C.green : avgCostDelta > 0 ? C.red : C.muted },
                                { label: "New Shares",       val: newQty > 0 ? newQty.toFixed(4) : "—",
                                  sub: `+${boughtShares.toFixed(4)} shares`, color: C.muted },
                                { label: "Unrealized P&L",   val: newUnrealPnl !== 0 ? `${newUnrealPnl >= 0 ? "+" : ""}${fmt$(newUnrealPnl)}` : "—",
                                  sub: `${newUnrealPct >= 0 ? "+" : ""}${newUnrealPct.toFixed(2)}%`,
                                  color: newUnrealPnl >= 0 ? C.green : C.red },
                                { label: "Total Cost Basis", val: `$${newCostBasis.toFixed(2)}`,
                                  sub: `+$${addAmt.toFixed(2)} added`, color: C.muted },
                              ].map(item => (
                                <div key={item.label} style={{ background: "rgba(200,169,106,0.04)", borderRadius: "12px", padding: "14px" }}>
                                  <p style={{ color: C.muted, fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                                  <p style={{ color: C.text, fontSize: "18px", fontWeight: 600, margin: "0 0 2px" }}>{item.val}</p>
                                  <p style={{ color: item.color, fontSize: "11px", margin: 0 }}>{item.sub}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: C.muted, fontSize: "13px" }}>No current position — avg-down calculator requires an existing holding.</p>
                          )}
                        </div>

                        {/* Entry Price Targets */}
                        <div style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px" }}>
                          <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Entry Price Targets
                          </p>
                          <p style={{ color: C.text, fontSize: "13px", margin: "0 0 18px", lineHeight: "1.5" }}>
                            What price achieves each margin of safety?
                          </p>

                          {intrinsicValue ? (
                            <>
                              <div style={{ marginBottom: "16px", padding: "12px 16px", background: "rgba(200,169,106,0.06)", borderRadius: "10px",
                                display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: C.muted, fontSize: "13px" }}>Intrinsic Value</span>
                                <span style={{ color: C.gold, fontSize: "13px", fontWeight: 600 }}>${intrinsicValue.toFixed(2)}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {targets.map(t => {
                                  const isBelowCurrent = currentPrice > 0 && currentPrice <= t.price;
                                  const barPct = currentPrice > 0 ? Math.min(100, (currentPrice / t.price) * 100) : 0;
                                  return (
                                    <div key={t.mos} style={{ padding: "12px 16px", borderRadius: "10px",
                                      border: `1px solid ${isBelowCurrent ? "rgba(143,214,148,0.3)" : C.borderSubtle}`,
                                      background: isBelowCurrent ? "rgba(143,214,148,0.04)" : "transparent" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                        <span style={{ color: C.muted, fontSize: "12px" }}>{t.mos}% MOS</span>
                                        <span style={{ color: isBelowCurrent ? C.green : C.text, fontSize: "14px", fontWeight: 600 }}>
                                          ${t.price.toFixed(2)}
                                          {isBelowCurrent && <span style={{ color: C.green, fontSize: "11px", marginLeft: "6px" }}>✓ met</span>}
                                        </span>
                                      </div>
                                      <div style={{ height: "3px", background: "rgba(200,169,106,0.1)", borderRadius: "2px" }}>
                                        <div style={{ height: "100%", width: `${barPct}%`,
                                          background: isBelowCurrent ? C.green : C.gold, borderRadius: "2px", transition: "width 0.3s" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {currentPrice > 0 && (
                                <p style={{ color: C.muted, fontSize: "12px", marginTop: "14px" }}>
                                  Current price: <span style={{ color: C.text }}>${currentPrice.toFixed(2)}</span>
                                  {intrinsicValue > currentPrice
                                    ? <span style={{ color: C.green }}> · {(((intrinsicValue - currentPrice) / intrinsicValue) * 100).toFixed(1)}% MOS</span>
                                    : <span style={{ color: C.red }}> · {(((currentPrice - intrinsicValue) / intrinsicValue) * 100).toFixed(1)}% above IV</span>
                                  }
                                </p>
                              )}
                            </>
                          ) : (
                            <p style={{ color: C.muted, fontSize: "13px" }}>Run a valuation scenario to see entry price targets.</p>
                          )}
                        </div>
                      </div>
                    </>
                }
              </section>
            );
          })()}


          {/* Model Assumptions */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <div style={{ marginBottom: "24px" }}>
              <p style={labelStyle}>Valuation Models</p>
              <h3 style={{ fontSize: "24px", margin: "8px 0 4px" }}>Assumptions & Inputs</h3>
              <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>
                Latest scenario per model. ⚠️ flags inputs that differ from current synced data by more than 10%.
              </p>
            </div>

            {scenarios.length === 0
              ? <p style={{ color: C.muted }}>No saved scenarios yet. Run a valuation to get started.</p>
              : <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                    <thead>
                      <tr style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "left" }}>
                        {["Model", "Case", "Price", "EPS", "FCF/sh", "Growth", "Discount", "Terminal", "IV", "MOS", "Updated"].map(h => (
                          <th key={h} style={{ paddingBottom: "12px", paddingRight: "14px", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(latestByModel).map((s: any) => {
                        const mos = Number(s.marginOfSafetyPercent);
                        const mosColor = mos >= 20 ? C.green : mos >= 0 ? C.gold : C.red;

                        // Staleness checks — compare stored inputs vs current synced values
                        const currentEps = detail?.eps != null ? Number(detail.eps) : null;
                        const currentFcf = detail?.freeCashFlowPerShare != null ? Number(detail.freeCashFlowPerShare) : null;
                        const storedEps  = s.earningsPerShare != null ? Number(s.earningsPerShare) : null;
                        const storedFcf  = s.freeCashFlowPerShare != null ? Number(s.freeCashFlowPerShare) : null;
                        const epsStale = currentEps != null && storedEps != null && Math.abs((currentEps - storedEps) / currentEps) > 0.10;
                        const fcfStale = currentFcf != null && storedFcf != null && Math.abs((currentFcf - storedFcf) / currentFcf) > 0.10;

                        const fmt = (v: any, suffix = "") => v != null ? `${Number(v).toFixed(2)}${suffix}` : "—";

                        return (
                          <tr key={s.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                            <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                              {MODEL_LABELS_EXT[s.modelType] ?? s.modelType}
                            </td>
                            <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                              {s.caseType ?? "—"}
                            </td>
                            <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                              {s.currentPrice != null ? `$${Number(s.currentPrice).toFixed(2)}` : "—"}
                            </td>
                            <td style={{ ...tableCellStyle, fontSize: "12px" }}>
                              {storedEps != null ? (
                                <span title={epsStale ? `Current: $${currentEps?.toFixed(2)}` : undefined}>
                                  ${storedEps.toFixed(2)}{epsStale ? " ⚠️" : ""}
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ ...tableCellStyle, fontSize: "12px" }}>
                              {storedFcf != null ? (
                                <span title={fcfStale ? `Current: $${currentFcf?.toFixed(2)}` : undefined}>
                                  ${storedFcf.toFixed(2)}{fcfStale ? " ⚠️" : ""}
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                              {fmt(s.growthRatePercent, "%")}
                            </td>
                            <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                              {fmt(s.discountRatePercent, "%")}
                            </td>
                            <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                              {s.terminalGrowthRatePercent != null
                                ? `${Number(s.terminalGrowthRatePercent).toFixed(1)}% g`
                                : s.terminalMultiple != null
                                  ? `${s.terminalMultiple}x`
                                  : "—"}
                            </td>
                            <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                              ${Number(s.intrinsicValue).toFixed(2)}
                            </td>
                            <td style={{ ...tableCellStyle, color: mosColor, fontWeight: 600 }}>
                              {mos >= 0 ? "+" : ""}{mos.toFixed(1)}%
                            </td>
                            <td style={{ ...tableCellStyle, color: C.muted, fontSize: "11px", whiteSpace: "nowrap" }}>
                              {new Date(s.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </section>

          {/* Asset Ledger */}
          {(() => {
            const isBuy  = (tx: any) => tx.transactionType === "BUY"  || tx.transactionType === "CDIV" || tx.transactionType === "DEPOSIT";
            const isSell = (tx: any) => tx.transactionType === "SELL" || tx.transactionType === "WITHDRAWAL";

            const totalRealizedGain = assetTx
              .filter(isSell)
              .reduce((sum: number, tx: any) => sum + Number(tx.realizedGain ?? 0), 0);
            const totalFees = assetTx
              .reduce((sum: number, tx: any) => sum + Number(tx.fees ?? 0), 0);
            const hasAnyFees = totalFees > 0;

            const filteredTx = assetTx.filter((tx: any) => {
              if (txFilter === "buy")  return isBuy(tx);
              if (txFilter === "sell") return isSell(tx);
              return true;
            });

            return (
              <section style={{ ...sectionStyle, marginBottom: "32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
                  <div>
                    <p style={labelStyle}>Asset Ledger</p>
                    <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>{symbol} Transactions</h3>
                  </div>
                  {/* Buy / All / Sell toggle */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    {(["all", "buy", "sell"] as const).map(f => (
                      <button key={f} onClick={() => setTxFilter(f)} style={{
                        background: txFilter === f ? C.gold : "transparent",
                        color: txFilter === f ? "#000" : C.muted,
                        border: `1px solid ${txFilter === f ? C.gold : C.border}`,
                        borderRadius: "8px", padding: "4px 14px", fontSize: "12px",
                        fontWeight: txFilter === f ? 700 : 400, cursor: "pointer",
                        textTransform: "capitalize",
                      }}>{f === "all" ? "All" : f === "buy" ? "Buys" : "Sells"}</button>
                    ))}
                  </div>
                </div>

                {/* Summary chips */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                  <div style={{ padding: "8px 18px", borderRadius: "999px", fontSize: "13px",
                    border: `1px solid ${totalRealizedGain >= 0 ? "rgba(143,214,148,0.3)" : "rgba(224,108,117,0.3)"}`,
                    background: totalRealizedGain >= 0 ? "rgba(143,214,148,0.06)" : "rgba(224,108,117,0.06)",
                    color: totalRealizedGain >= 0 ? C.green : C.red }}>
                    Realized Gain&nbsp;&nbsp;
                    <strong>{totalRealizedGain >= 0 ? "+" : ""}{fmt$(totalRealizedGain)}</strong>
                  </div>
                  {hasAnyFees && (
                    <div style={{ padding: "8px 18px", borderRadius: "999px", fontSize: "13px",
                      border: `1px solid ${C.borderSubtle}`, color: C.muted }}>
                      Total Fees&nbsp;&nbsp;
                      <strong style={{ color: C.text }}>${totalFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
                      {["Date", "Type", "Quantity", "Price", ...(hasAnyFees ? ["Fees"] : []), "Realized Gain"].map(h => (
                        <th key={h} style={{ paddingBottom: "12px", paddingRight: "16px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.length === 0
                      ? <tr><td colSpan={hasAnyFees ? 6 : 5} style={{ padding: "20px 0", color: C.muted }}>No transactions.</td></tr>
                      : filteredTx.map((tx: any) => {
                          const sell = isSell(tx);
                          const gain = Number(tx.realizedGain ?? 0);
                          return (
                            <tr key={tx.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                              <td style={tableCellStyle}>{new Date(tx.transactionDate + "T00:00:00").toLocaleDateString()}</td>
                              <td style={tableCellStyle}><span style={pillStyle(tx.transactionType)}>{tx.transactionType}</span></td>
                              <td style={tableCellStyle}>{Number(tx.quantity).toFixed(4)}</td>
                              <td style={tableCellStyle}>${Number(tx.pricePerUnit).toFixed(2)}</td>
                              {hasAnyFees && <td style={{ ...tableCellStyle, color: C.muted }}>${Number(tx.fees).toFixed(2)}</td>}
                              <td style={{ ...tableCellStyle, color: sell ? (gain >= 0 ? C.green : C.red) : C.muted }}>
                                {sell ? `${gain >= 0 ? "+" : ""}${fmt$(gain)}` : "—"}
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </section>
            );
          })()}

          {/* Tax Lots */}
          {(() => {
            const LOT_COLS = [
              { label: "Acquired",   key: "acquisitionDate",   numeric: false },
              { label: "Purchased",  key: "quantityPurchased", numeric: true  },
              { label: "Remaining",  key: "quantityRemaining", numeric: true  },
              { label: "Cost/Share", key: "costBasisPerUnit",  numeric: true  },
              { label: "Lot Cost",   key: "totalCostBasis",    numeric: true  },
              { label: "Status",     key: "closed",            numeric: false },
            ];

            const sortedLots = [...taxLots].sort((a: any, b: any) => {
              const { col, dir } = lotSort;
              let av = a[col], bv = b[col];
              if (col === "acquisitionDate") {
                av = new Date(av).getTime(); bv = new Date(bv).getTime();
              } else if (col === "closed") {
                av = av ? 1 : 0; bv = bv ? 1 : 0;
              } else {
                av = Number(av); bv = Number(bv);
              }
              return dir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
            });

            const toggleSort = (key: string) => {
              setLotSort(prev => prev.col === key
                ? { col: key, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { col: key, dir: "asc" });
            };

            return (
              <section style={{ ...sectionStyle, marginBottom: "32px" }}>
                <p style={labelStyle}>Tax Lots</p>
                <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Open & Closed Lots</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
                      {LOT_COLS.map(({ label, key }) => {
                        const active = lotSort.col === key;
                        return (
                          <th key={key} onClick={() => toggleSort(key)}
                            style={{ paddingBottom: "12px", paddingRight: "16px", cursor: "pointer",
                              color: active ? C.gold : C.muted, userSelect: "none", whiteSpace: "nowrap" }}>
                            {label} {active ? (lotSort.dir === "asc" ? "↑" : "↓") : <span style={{ opacity: 0.3 }}>↕</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLots.length === 0
                      ? <tr><td colSpan={6} style={{ padding: "20px 0", color: C.muted }}>No tax lots.</td></tr>
                      : sortedLots.map((lot: any) => (
                          <tr key={lot.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                            <td style={tableCellStyle}>{new Date(lot.acquisitionDate + "T00:00:00").toLocaleDateString()}</td>
                            <td style={tableCellStyle}>{Number(lot.quantityPurchased).toFixed(4)}</td>
                            <td style={tableCellStyle}>{Number(lot.quantityRemaining).toFixed(4)}</td>
                            <td style={tableCellStyle}>${Number(lot.costBasisPerUnit).toFixed(2)}</td>
                            <td style={tableCellStyle}>${Number(lot.totalCostBasis).toFixed(2)}</td>
                            <td style={tableCellStyle}>
                              <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px",
                                background: lot.closed ? "rgba(224,108,117,0.12)" : "rgba(143,214,148,0.12)",
                                color: lot.closed ? C.red : C.green }}>
                                {lot.closed ? "CLOSED" : "OPEN"}
                              </span>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </section>
            );
          })()}

          {/* FIFO Allocations — hidden from UI, data kept in DB for gain calculations
          <section style={sectionStyle}>
            <p style={labelStyle}>Realized Gain Audit</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Tax Lot Allocations</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
                  {["Qty Allocated","Proceeds","Cost Basis","Realized Gain","Date"].map(h => (
                    <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0
                  ? <tr><td colSpan={5} style={{ padding: "20px 0", color: C.muted }}>No allocations yet.</td></tr>
                  : allocations.map((a: any) => (
                    <tr key={a.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                      <td style={tableCellStyle}>{Number(a.quantityAllocated).toFixed(4)}</td>
                      <td style={tableCellStyle}>${Number(a.proceeds).toFixed(2)}</td>
                      <td style={tableCellStyle}>${Number(a.costBasis).toFixed(2)}</td>
                      <td style={{ ...tableCellStyle, color: Number(a.realizedGain) >= 0 ? C.green : C.red }}>
                        ${Number(a.realizedGain).toFixed(2)}
                      </td>
                      <td style={tableCellStyle}>{new Date(a.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </section>
          */}
        </>
      )}
    </div>
  );
}
