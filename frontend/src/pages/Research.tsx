import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import { API } from "../constants";
import { C, sectionStyle, labelStyle, tooltipStyle, pillStyle, tableCellStyle } from "../theme";
import { Nasdaq100SyncWidget } from "../components/Nasdaq100SyncWidget";

const MODELS = ["DCF", "OWNER_EARNINGS", "PEG", "GRAHAM", "CRYPTO_RISK"] as const;
type Model = typeof MODELS[number];

const MODEL_LABELS: Record<Model, string> = {
  DCF:            "Discounted Cash Flow",
  OWNER_EARNINGS: "Owner Earnings (FCF)",
  PEG:            "PEG Ratio (Peter Lynch)",
  GRAHAM:         "Graham Number",
  CRYPTO_RISK:    "Crypto Risk-Adjusted",
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
  const [dcaRecs, setDcaRecs]           = useState<any[]>([]);
  const [dcaCash, setDcaCash]           = useState("1000");
  const [formVals, setFormVals]         = useState({
    currentPrice: "", earningsPerShare: "", freeCashFlowPerShare: "",
    growthRatePercent: "", discountRatePercent: "", years: "10",
    terminalGrowthRatePercent: "2.5", exitMultiple: "20",
  });
  const [submitting, setSubmitting]     = useState(false);
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
    setSearchParams({ symbol });

    fetch(`${API}/assets/${symbol}/detail`)
      .then(r => r.json()).then(d => {
        setDetail(d);
        const price      = d?.holding?.marketPrice;
        const eps        = d?.eps;
        const fcf        = d?.freeCashFlowPerShare;
        const rawGrowth  = d?.revenueGrowthTTM; // stored as decimal e.g. 0.08
        const growth     = rawGrowth != null
          ? String(Math.round(rawGrowth * 100 * 10) / 10)  // e.g. 0.083 → "8.3"
          : "";
        setFormVals(prev => ({
          ...prev,
          ...(price  != null ? { currentPrice:         String(price) } : {}),
          ...(eps    != null ? { earningsPerShare:      String(eps)   } : {}),
          ...(fcf    != null ? { freeCashFlowPerShare:  String(fcf)   } : {}),
          ...(growth          ? { growthRatePercent:    growth        } : {}),
          discountRatePercent:       prev.discountRatePercent || "10",
          years:                     prev.years               || "10",
          terminalGrowthRatePercent: prev.terminalGrowthRatePercent || "2.5",
          exitMultiple:              prev.exitMultiple         || "20",
        }));
      }).catch(console.error);

    fetch(`${API}/historical-prices/${symbol}`)
      .then(r => r.json()).then(d => setPrices(Array.isArray(d) ? d : [])).catch(console.error);

    fetch(`${API}/dca/${symbol}/all?availableCash=${dcaCash}`)
      .then(r => r.json()).then(setDcaRecs).catch(console.error);

    fetch(`${API}/financials/${symbol}`)
      .then(r => r.json()).then(d => setFinancials({ annual: d?.annual ?? [], quarterly: d?.quarterly ?? [] })).catch(console.error);
    // ^^^ reads from DB (no FMP call) — use Sync to refresh
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
    fetch(`${API}/dca/${symbol}/all?availableCash=${cash}`)
      .then(r => r.json()).then(setDcaRecs).catch(console.error);
  };

  const [financials, setFinancials]   = useState<{ annual: any[], quarterly: any[] }>({ annual: [], quarterly: [] });
  const [finTab, setFinTab]           = useState<"profitability"|"growth"|"health"|"valuation">("profitability");
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
      setSyncMsg(finRows.annual.length > 0
        ? `Synced: ${data.historicalPricesSynced} price bars, profile + metrics + financials updated.`
        : `Synced: ${data.historicalPricesSynced} price bars, profile + metrics updated, no financial data for this symbol.`
      );
      // Pre-fill valuation form with fresh metrics from sync response + reloaded holding
      const eps   = data.metrics?.epsTTM;
      const fcf   = data.metrics?.freeCashFlowPerShareTTM;
      const price = newDetail?.holding?.marketPrice;
      setFormVals(prev => ({
        ...prev,
        ...(eps   != null ? { earningsPerShare:      String(eps)   } : {}),
        ...(fcf   != null ? { freeCashFlowPerShare:  String(fcf)   } : {}),
        ...(price != null ? { currentPrice:          String(price) } : {}),
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
    try {
      await fetch(`${API}/valuations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          modelType: model,
          caseType: "BASE",
          currentPrice:              Number(formVals.currentPrice),
          earningsPerShare:          formVals.earningsPerShare          ? Number(formVals.earningsPerShare)          : null,
          freeCashFlowPerShare:      formVals.freeCashFlowPerShare      ? Number(formVals.freeCashFlowPerShare)      : null,
          growthRatePercent:         Number(formVals.growthRatePercent),
          discountRatePercent:       Number(formVals.discountRatePercent),
          years:                     Number(formVals.years),
          terminalGrowthRatePercent: Number(formVals.terminalGrowthRatePercent),
          exitMultiple:              formVals.exitMultiple               ? Number(formVals.exitMultiple)              : null,
        }),
      });
      // Reload detail to pick up new scenario
      const updated = await fetch(`${API}/assets/${symbol}/detail`).then(r => r.json());
      setDetail(updated);
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunPresets = async () => {
    if (!symbol || !formVals.currentPrice) return;
    if (!formVals.earningsPerShare && !formVals.freeCashFlowPerShare) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/valuations/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          currentPrice:         Number(formVals.currentPrice),
          earningsPerShare:     formVals.earningsPerShare     ? Number(formVals.earningsPerShare)     : null,
          freeCashFlowPerShare: formVals.freeCashFlowPerShare ? Number(formVals.freeCashFlowPerShare) : null,
        }),
        // Note: presets use hardcoded terminal growth rates and exit multiples server-side
      });
      const updated = await fetch(`${API}/assets/${symbol}/detail`).then(r => r.json());
      setDetail(updated);
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Derived valuation data
  const scenarios      = detail?.valuationScenarios ?? [];
  const bearCase       = scenarios.find((s: any) => s.caseType === "BEAR");
  const baseCase       = scenarios.find((s: any) => s.caseType === "BASE");
  const bullCase       = scenarios.find((s: any) => s.caseType === "BULL");
  const latestVal      = baseCase ?? scenarios[0];
  const buyBelow       = latestVal ? Number(latestVal.intrinsicValue) * (1 - targetMos / 100) : 0;
  const taxLots        = detail?.taxLots ?? [];
  const allocations    = detail?.taxLotAllocations ?? [];
  const assetTx        = detail?.transactions ?? [];
  const holding        = detail?.holding;
  const avgCost        = holding ? Number(holding.averageCostBasis) : null;

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

  const valTrendData = [...scenarios].reverse().slice(0, 10).map((s: any) => ({
    date: new Date(s.createdAt).toLocaleDateString(),
    intrinsicValue: Number(s.intrinsicValue ?? 0),
    case: s.caseType,
  }));

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", marginBottom: "32px" }}>
            {[
              { label: "Position Value", value: holding ? `$${Number(holding.marketValue).toLocaleString("en-US",{minimumFractionDigits:2})}` : "Not held" },
              { label: "Intrinsic Value", value: latestVal ? `$${Number(latestVal.intrinsicValue).toFixed(2)}` : "—" },
              { label: "Margin of Safety", value: latestVal ? `${Number(latestVal.marginOfSafetyPercent).toFixed(2)}%` : "—",
                color: latestVal ? (Number(latestVal.marginOfSafetyPercent) >= 20 ? C.green : Number(latestVal.marginOfSafetyPercent) >= 0 ? C.gold : C.red) : C.text },
              { label: `Buy Below (${targetMos}% MOS)`, value: latestVal ? `$${buyBelow.toFixed(2)}` : "—" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
                <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
                <h3 style={{ fontSize: "26px", marginTop: "14px", marginBottom: 0, color: color ?? C.text }}>{value}</h3>
              </div>
            ))}
          </div>

          {/* Price History Chart */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
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
                {/* Period toggle */}
                {(["annual","quarter"] as const).map(p => (
                  <button key={p} onClick={() => setFinPeriod(p)} style={{
                    padding: "8px 20px", borderRadius: "999px", cursor: "pointer",
                    fontFamily: C.font, fontSize: "13px",
                    background: finPeriod === p ? "rgba(200,169,106,0.15)" : "transparent",
                    color: finPeriod === p ? C.gold : C.muted,
                    border: finPeriod === p ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}`,
                  }}>{p === "annual" ? "Annual" : "Quarterly"}</button>
                ))}
                <div style={{ width: "1px", background: C.borderSubtle, margin: "0 4px" }} />
                {/* Sub-tab toggle */}
                {(["profitability","growth","health","valuation"] as const).map(tab => (
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

            {financials.annual.length === 0
              ? <p style={{ color: C.muted }}>No financial data yet — click ⟳ Sync to load.</p>
              : (() => {
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

                  if (rows.length === 0) {
                    return <p style={{ color: C.muted }}>No quarterly data — click ⟳ Sync to load.</p>;
                  }

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                      {charts[finTab].map((c: any) => (
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <label style={{ color: C.muted, fontSize: "13px" }}>Target MOS</label>
                <input type="number" min={0} max={90} value={targetMos}
                  onChange={e => setTargetMos(Number(e.target.value))}
                  style={{ width: "80px", background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
                    borderRadius: "8px", padding: "6px 10px", fontFamily: C.font }} />
                <span style={{ color: C.muted }}>%</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px", marginTop: "28px" }}>
              {[["Bear Case", bearCase], ["Base Case", baseCase], ["Bull Case", bullCase]].map(([label, sc]: any) => (
                <div key={label} style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px" }}>
                  <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
                  {/* Primary DCF value */}
                  <div style={{ marginTop: "12px" }}>
                    <p style={{ color: C.muted, fontSize: "11px", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Primary (DCF)</p>
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

            {/* Fair Value Range bar */}
            {bearCase && bullCase && (() => {
              const lo  = Number(bearCase.intrinsicValue);
              const hi  = Number(bullCase.intrinsicValue);
              const cur = Number(detail?.holding?.marketPrice ?? bearCase.currentPrice ?? 0);
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

                  {(() => {
                    const isDcfModel = model === "DCF" || model === "OWNER_EARNINGS";
                    const growthLabel = model === "DCF" ? "EPS Growth Rate (%)"
                                      : model === "OWNER_EARNINGS" ? "FCF Growth Rate (%)"
                                      : "Growth Rate (%)";
                    const fields = [
                      { key: "currentPrice",              label: "Current Price ($)",                                          show: true },
                      { key: "earningsPerShare",           label: "EPS ($)",                                                    show: model !== "OWNER_EARNINGS" },
                      { key: "freeCashFlowPerShare",       label: "FCF per Share ($)",                                          show: model === "OWNER_EARNINGS" },
                      { key: "growthRatePercent",          label: growthLabel,                                                  show: true },
                      { key: "discountRatePercent",        label: model === "GRAHAM" ? "Bond Yield / Discount (%)" : "Discount Rate (%)", show: model !== "PEG" },
                      { key: "years",                      label: "Years",                                                      show: isDcfModel },
                      { key: "terminalGrowthRatePercent",  label: "Terminal Growth Rate (%) — perpetuity",                     show: isDcfModel },
                      { key: "exitMultiple",               label: "Exit Multiple — cross-check (optional)",                    show: isDcfModel },
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

                  <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                    <button onClick={handleRunValuation} disabled={submitting}
                      style={{ background: C.gold, color: C.bg, border: "none", borderRadius: "10px",
                        padding: "12px 24px", cursor: "pointer", fontFamily: C.font, fontSize: "14px", fontWeight: 700 }}>
                      {submitting ? "Running…" : "Run Single Scenario"}
                    </button>
                    <div style={{ position: "relative", display: "inline-block" }}
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
                          PRESET ASSUMPTIONS (EPS-based, 10 yrs)
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
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* DCA Recommendation */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
              <div>
                <p style={labelStyle}>DCA Intelligence</p>
                <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>Position Recommendation</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <label style={{ color: C.muted, fontSize: "13px" }}>Available Cash ($)</label>
                <input
                  type="number" value={dcaCash}
                  onChange={e => { setDcaCash(e.target.value); }}
                  onBlur={e => refreshDCA(e.target.value)}
                  style={{ width: "100px", background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
                    borderRadius: "8px", padding: "6px 10px", fontFamily: C.font }} />
              </div>
            </div>

            {dcaRecs.length === 0
              ? <p style={{ color: C.muted }}>Run a valuation scenario first to unlock DCA recommendations.</p>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
                  {dcaRecs.map((rec: any) => {
                    const actionColor = rec.action === "BUY_MORE" ? C.green : rec.action === "REDUCE" ? C.red : C.gold;
                    const stratLabel: Record<string, string> = {
                      VALUE_FOCUSED:    "Value Focused",
                      RISK_ADJUSTED:    "Risk Adjusted",
                      AGGRESSIVE_GROWTH: "Aggressive Growth",
                    };
                    return (
                      <div key={rec.strategyUsed} style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: "18px", padding: "24px" }}>
                        <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {stratLabel[rec.strategyUsed] ?? rec.strategyUsed}
                        </p>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                          <span style={{ padding: "4px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                            background: rec.action === "BUY_MORE" ? "rgba(143,214,148,0.12)" : rec.action === "REDUCE" ? "rgba(224,108,117,0.12)" : "rgba(200,169,106,0.12)",
                            color: actionColor }}>
                            {rec.action.replace("_", " ")}
                          </span>
                          <span style={{ color: C.muted, fontSize: "12px" }}>
                            {rec.confidenceScore}% confidence
                          </span>
                        </div>

                        {rec.action === "BUY_MORE" && (
                          <>
                            <p style={{ color: C.text, fontSize: "22px", margin: "0 0 4px", fontWeight: 600 }}>
                              ${Number(rec.suggestedAmount).toFixed(2)}
                            </p>
                            <p style={{ color: C.muted, fontSize: "13px", margin: "0 0 12px" }}>
                              ≈ {Number(rec.suggestedQuantity).toFixed(4)} shares
                            </p>
                          </>
                        )}

                        <p style={{ color: C.muted, fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                          {rec.rationale}
                        </p>

                        {/* Confidence bar */}
                        <div style={{ marginTop: "16px", height: "4px", background: "rgba(200,169,106,0.1)", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${rec.confidenceScore}%`, background: actionColor, borderRadius: "2px" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </section>

          {/* Valuation History */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <p style={labelStyle}>Valuation History</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Intrinsic Value Over Time</h3>
            {valTrendData.length === 0
              ? <p style={{ color: C.muted }}>No saved scenarios yet.</p>
              : <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={valTrendData}>
                    <CartesianGrid stroke="rgba(200,169,106,0.08)" vertical={false} />
                    <XAxis dataKey="date" stroke={C.muted} tick={{ fontSize: 11 }} />
                    <YAxis stroke={C.muted} tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Intrinsic Value"]} />
                    <Line type="monotone" dataKey="intrinsicValue" stroke={C.gold} strokeWidth={2} dot={{ r: 4, fill: C.gold }} />
                  </LineChart>
                </ResponsiveContainer>
            }

            {scenarios.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "28px" }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
                    {["Date","Model","Case","Intrinsic Value","MOS","Assumptions","Label"].map(h => (
                      <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.slice(0, 10).map((s: any) => (
                    <tr key={s.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                      <td style={tableCellStyle}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>{s.modelType}</td>
                      <td style={tableCellStyle}>{s.caseType ?? "—"}</td>
                      <td style={tableCellStyle}>${Number(s.intrinsicValue).toFixed(2)}</td>
                      <td style={{ ...tableCellStyle, color: Number(s.marginOfSafetyPercent) >= 20 ? C.green : Number(s.marginOfSafetyPercent) >= 0 ? C.gold : C.red }}>
                        {Number(s.marginOfSafetyPercent).toFixed(2)}%
                      </td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                        g={s.growthRatePercent}% d={s.discountRatePercent}%{s.terminalGrowthRatePercent != null ? ` gT=${s.terminalGrowthRatePercent}%` : s.terminalMultiple != null ? ` ${s.terminalMultiple}x` : ""}
                      </td>
                      <td style={{ ...tableCellStyle, fontSize: "12px",
                        color: s.valuationLabel === "UNDERVALUED" ? C.green : s.valuationLabel === "OVERVALUED" ? C.red : C.gold }}>
                        {s.valuationLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Asset Ledger */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <p style={labelStyle}>Asset Ledger</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>{symbol} Transactions</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
                  {["Date","Type","Quantity","Price","Fees","Realized Gain"].map(h => (
                    <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assetTx.length === 0
                  ? <tr><td colSpan={6} style={{ padding: "20px 0", color: C.muted }}>No transactions.</td></tr>
                  : assetTx.map((tx: any) => (
                    <tr key={tx.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                      <td style={tableCellStyle}>{tx.transactionDate}</td>
                      <td style={tableCellStyle}><span style={pillStyle(tx.transactionType)}>{tx.transactionType}</span></td>
                      <td style={tableCellStyle}>{Number(tx.quantity).toFixed(4)}</td>
                      <td style={tableCellStyle}>${Number(tx.pricePerUnit).toFixed(2)}</td>
                      <td style={tableCellStyle}>${Number(tx.fees).toFixed(2)}</td>
                      <td style={{ ...tableCellStyle, color: Number(tx.realizedGain) >= 0 ? C.green : C.red }}>
                        ${Number(tx.realizedGain).toFixed(2)}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </section>

          {/* Tax Lots */}
          <section style={{ ...sectionStyle, marginBottom: "32px" }}>
            <p style={labelStyle}>Tax Lots</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Open & Closed Lots</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
                  {["Acquired","Purchased","Remaining","Cost/Share","Lot Cost","Status"].map(h => (
                    <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taxLots.length === 0
                  ? <tr><td colSpan={6} style={{ padding: "20px 0", color: C.muted }}>No tax lots.</td></tr>
                  : taxLots.map((lot: any) => (
                    <tr key={lot.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                      <td style={tableCellStyle}>{lot.acquisitionDate}</td>
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

          {/* FIFO Allocations */}
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
        </>
      )}
    </div>
  );
}
