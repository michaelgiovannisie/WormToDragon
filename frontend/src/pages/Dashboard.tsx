import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { API, PORTFOLIO_ID, ACCOUNT_ID } from "../constants";
import { C, PIE_COLORS, sectionStyle, labelStyle, tooltipStyle, pillStyle, tableCellStyle } from "../theme";
import { Nasdaq100SyncWidget } from "../components/Nasdaq100SyncWidget";
import { HoldingsSyncWidget } from "../components/HoldingsSyncWidget";

// ── helpers ────────────────────────────────────────────────────────────────

function fmt$(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-$" : "$") + abs;
}

type SortDir = "asc" | "desc";

function useSortable<T>(
  data: T[],
  defaultKey: keyof T | null = null,
  defaultDir: SortDir = "asc",
  descFirstKeys: (keyof T)[] = [],
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(key: keyof T) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(descFirstKeys.includes(key) ? "desc" : "asc"); }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return { sorted, sortKey, sortDir, toggle };
}

function SortTh({ label, sortKey, activeSortKey, sortDir, onSort }: {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: SortDir;
  onSort: (k: string) => void;
}) {
  const active = activeSortKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        color: active ? C.gold : C.muted,
        fontSize: "12px", textTransform: "uppercase" as const,
        letterSpacing: "0.06em", textAlign: "left" as const,
        paddingBottom: "12px", cursor: "pointer",
        userSelect: "none" as const, whiteSpace: "nowrap" as const,
      }}
    >
      {label}
      <span style={{ marginLeft: "4px", opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}

const RANGES = ["1w","1m","3m","ytd","1y","all"];

// ── component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary]           = useState<any>(null);
  const [holdings, setHoldings]         = useState<any[]>([]);
  const [snapshots, setSnapshots]       = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [chartRange, setChartRange]     = useState("1y");
  const [benchmark, setBenchmark]       = useState("SPY");
  const [benchmarkInput, setBenchmarkInput] = useState("SPY");
  const [benchmarkPrices, setBenchmarkPrices] = useState<any[]>([]);
  const [showAllTx, setShowAllTx]       = useState(false);

  // Core data — summary, holdings, transactions. Only re-fetched on mount.
  const loadCoreData = () => {
    Promise.all([
      fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}/summary`).then(r => r.json()),
      fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}`).then(r => r.json()),
      fetch(`${API}/transactions/account/${ACCOUNT_ID}`).then(r => r.json()),
    ]).then(([s, h, t]) => {
      setSummary(s);
      setHoldings(Array.isArray(h) ? h : []);
      setTransactions(Array.isArray(t) ? t : []);
      setLoading(false);
    }).catch(e => { console.error(e); setLoading(false); });
  };

  // Snapshots — range-dependent, cheap to re-fetch.
  const loadSnapshots = (range: string) => {
    fetch(`${API}/portfolios/${PORTFOLIO_ID}/value-history?range=${range}`)
      .then(r => r.json()).then(setSnapshots).catch(console.error);
  };

  // On mount: load everything once.
  useEffect(() => {
    loadCoreData();
    loadSnapshots(chartRange);
  }, []);

  // Benchmark — re-fetch only when the symbol changes.
  useEffect(() => {
    if (!benchmark || benchmark === "none") { setBenchmarkPrices([]); return; }
    fetch(`${API}/historical-prices/${benchmark.toUpperCase()}`)
      .then(r => r.json()).then(d => setBenchmarkPrices(Array.isArray(d) ? d : []))
      .catch(() => setBenchmarkPrices([]));
  }, [benchmark]);

  const handleRangeChange = (range: string) => {
    setChartRange(range);
    loadSnapshots(range);
  };

  // ── chart data ─────────────────────────────────────────────────────────

  const trendData = snapshots.map((s: any) => ({ date: s.date, value: Number(s.value ?? 0) }));

  const benchmarkChartData = (() => {
    if (trendData.length === 0 || benchmarkPrices.length === 0) return trendData;

    const bMap: Record<string, number> = {};
    for (const p of benchmarkPrices) bMap[p.priceDate] = Number(p.close);

    const firstDate = trendData[0].date;
    const sortedBDates = Object.keys(bMap).sort();
    const firstBDate = sortedBDates.find(d => d >= firstDate);
    if (!firstBDate) return trendData;

    const firstPortfolioValue = trendData[0].value;
    const firstBenchmarkClose = bMap[firstBDate];
    if (!firstPortfolioValue || !firstBenchmarkClose) return trendData;

    // O(n+m) pointer walk — both series are date-sorted ascending
    return (() => {
      let bPtr = 0;
      return trendData.map(pt => {
        while (bPtr + 1 < sortedBDates.length && sortedBDates[bPtr + 1] <= pt.date) bPtr++;
        const nearestDate = sortedBDates[bPtr] <= pt.date ? sortedBDates[bPtr] : null;
        const bClose = nearestDate ? bMap[nearestDate] : null;
        const benchmarkNorm = bClose != null
          ? (bClose / firstBenchmarkClose) * firstPortfolioValue
          : null;
        return { ...pt, benchmark: benchmarkNorm };
      });
    })();
  })();

  const alphaStats = (() => {
    const pts = benchmarkChartData.filter((p: any) => p.benchmark != null);
    if (pts.length < 2 || trendData.length < 2) return null;
    const firstValue   = trendData[0].value;
    const lastValue    = trendData[trendData.length - 1].value;
    const firstBench   = pts[0].benchmark as number;
    const lastBench    = pts[pts.length - 1].benchmark as number;
    const portfolioRet = ((lastValue - firstValue) / firstValue) * 100;
    const benchmarkRet = ((lastBench - firstBench) / firstBench) * 100;
    const alpha        = portfolioRet - benchmarkRet;
    return { portfolioRet, benchmarkRet, alpha };
  })();

  // ── derived data ────────────────────────────────────────────────────────

  // Use the backend-computed unrealizedGainPercent (cost basis is open positions
  // only — mixing it with all-time realized gains in the frontend produces a
  // misleading number).
  const unrealizedReturnPct = Number(summary?.unrealizedGainPercent ?? 0);

  const metricCards = [
    { label: "Portfolio Value",    value: fmt$(Number(summary?.totalMarketValue ?? 0)) },
    { label: "Unrealized Gain",    value: fmt$(Number(summary?.totalUnrealizedGain ?? 0)), color: Number(summary?.totalUnrealizedGain ?? 0) >= 0 ? C.green : C.red },
    { label: "Realized Gain",      value: fmt$(Number(summary?.totalRealizedGain ?? 0)),   color: Number(summary?.totalRealizedGain ?? 0) >= 0 ? C.green : C.red },
    { label: "Unrealized Return",  value: `${unrealizedReturnPct >= 0 ? "+" : ""}${unrealizedReturnPct.toFixed(2)}%`, color: unrealizedReturnPct >= 0 ? C.green : C.red },
    { label: "Positions",          value: String(holdings.length) },
  ];

  // Enrich holdings with numeric sortable fields; default sort: market value desc.
  const enrichedHoldings = holdings.map((h: any) => ({
    ...h,
    _symbol:       h.symbol as string,
    _marketValue:  Number(h.marketValue),
    _unrealGain:   Number(h.unrealizedGain),
    _return:       Number(h.totalCostBasis) > 0
                     ? (Number(h.marketValue) - Number(h.totalCostBasis)) / Number(h.totalCostBasis) * 100
                     : 0,
    _quantity:     Number(h.quantityHeld),
    _avgCost:      Number(h.averageCostBasis),
    _costBasis:    Number(h.totalCostBasis),
  }));
  const holdingsSort = useSortable(
    enrichedHoldings, "_marketValue", "desc",
    ["_marketValue", "_costBasis", "_unrealGain", "_return", "_quantity"],
  );

  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  const visibleTx = showAllTx ? recentTx : recentTx.slice(0, 10);

  // ── render ──────────────────────────────────────────────────────────────

  if (loading) return <p style={{ color: C.gold, fontFamily: C.font, padding: "40px" }}>Loading…</p>;

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Portfolio Dashboard</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>
        Long-Term Compounders
      </h2>
      <p style={{ color: C.muted, marginBottom: "24px" }}>
        A refined view of capital, conviction, and performance.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <HoldingsSyncWidget onComplete={loadCoreData} />
        <div style={{ marginLeft: "auto" }}>
          <Nasdaq100SyncWidget />
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "20px", marginBottom: "32px" }}>
        {metricCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
            <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: "28px", marginTop: "14px", marginBottom: 0, color: color ?? C.text }}>{value}</h3>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginBottom: "32px" }}>
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div>
              <p style={labelStyle}>Portfolio Trend</p>
              <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>Value Over Time</h3>
            </div>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {RANGES.map(r => (
                <button key={r} onClick={() => handleRangeChange(r)} style={{
                  background: chartRange === r ? C.gold : "transparent",
                  color: chartRange === r ? "#000" : C.muted,
                  border: `1px solid ${chartRange === r ? C.gold : C.border}`,
                  borderRadius: "8px", padding: "4px 10px", fontSize: "12px",
                  fontWeight: chartRange === r ? 700 : 400,
                  cursor: "pointer", textTransform: "uppercase"
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Benchmark selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ color: C.muted, fontSize: "12px" }}>vs</span>
            <input
              value={benchmarkInput}
              onChange={e => setBenchmarkInput(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") setBenchmark(benchmarkInput || "none"); }}
              placeholder="SPY, QQQ, MSFT…"
              style={{
                background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
                borderRadius: "8px", color: C.text, padding: "3px 10px", fontSize: "12px",
                width: "110px", outline: "none",
              }}
            />
            <button onClick={() => setBenchmark(benchmarkInput || "none")} style={{
              background: "rgba(200,169,106,0.12)", color: C.gold,
              border: `1px solid ${C.gold}`, borderRadius: "8px",
              padding: "3px 10px", fontSize: "12px", cursor: "pointer",
            }}>Apply</button>
            {benchmark !== "none" && (
              <button onClick={() => { setBenchmark("none"); setBenchmarkInput(""); }} style={{
                background: "transparent", color: C.muted,
                border: `1px solid ${C.border}`, borderRadius: "8px",
                padding: "3px 10px", fontSize: "12px", cursor: "pointer",
              }}>Clear</button>
            )}
            {alphaStats && (
              <span style={{
                marginLeft: "8px", fontSize: "12px", padding: "3px 12px",
                borderRadius: "999px",
                background: alphaStats.alpha >= 0 ? "rgba(143,214,148,0.1)" : "rgba(224,108,117,0.1)",
                color: alphaStats.alpha >= 0 ? C.green : C.red,
                border: `1px solid ${alphaStats.alpha >= 0 ? "rgba(143,214,148,0.3)" : "rgba(224,108,117,0.3)"}`,
              }}>
                {alphaStats.alpha >= 0 ? "+" : ""}{alphaStats.alpha.toFixed(2)}% vs {benchmark}
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={benchmarkChartData}>
              <CartesianGrid stroke="rgba(200,169,106,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke={C.muted} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={60} />
              <YAxis stroke={C.muted} tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v: any, name: string) => [
                fmt$(Number(v)),
                name === "benchmark" ? benchmark : "Portfolio"
              ]} />
              <Line type="monotone" dataKey="value" stroke={C.green} strokeWidth={2} dot={false} name="Portfolio" />
              {benchmark !== "none" && (
                <Line type="monotone" dataKey="benchmark" stroke="#60a5fa" strokeWidth={1.5}
                  strokeDasharray="6 3" dot={false} name="benchmark" connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>

          {alphaStats && (
            <div style={{ display: "flex", gap: "24px", marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${C.borderSubtle}` }}>
              {[
                { label: "Your Return",         value: `${alphaStats.portfolioRet >= 0 ? "+" : ""}${alphaStats.portfolioRet.toFixed(2)}%`, color: alphaStats.portfolioRet >= 0 ? C.green : C.red },
                { label: `${benchmark} Return`, value: `${alphaStats.benchmarkRet >= 0 ? "+" : ""}${alphaStats.benchmarkRet.toFixed(2)}%`, color: "#60a5fa" },
                { label: "Alpha",               value: `${alphaStats.alpha >= 0 ? "+" : ""}${alphaStats.alpha.toFixed(2)}%`,               color: alphaStats.alpha >= 0 ? C.green : C.red },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p style={{ color: C.muted, fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                  <p style={{ color, fontSize: "18px", fontWeight: 600, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <p style={labelStyle}>Allocation</p>
          <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>By Position</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={holdings} dataKey="marketValue" nameKey="symbol"
                cx="50%" cy="55%" innerRadius={70} outerRadius={110} paddingAngle={3}>
                {holdings.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt$(Number(v)), "Value"]} />
              <Legend formatter={(v) => <span style={{ color: C.muted, fontSize: "12px" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Holdings table */}
      <section style={{ ...sectionStyle, marginBottom: "32px" }}>
        <p style={labelStyle}>Holdings</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Current Positions</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {(["_symbol","_quantity","_avgCost","_costBasis","_marketValue","_unrealGain","_return"] as const).map((key, i) => (
                <SortTh
                  key={key}
                  label={["Symbol","Quantity","Avg Cost","Cost Basis","Market Value","Unrealized Gain","Return %"][i]}
                  sortKey={key}
                  activeSortKey={holdingsSort.sortKey as string}
                  sortDir={holdingsSort.sortDir}
                  onSort={k => holdingsSort.toggle(k as any)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {holdingsSort.sorted.map((h: any) => (
              <tr key={h.assetId} style={{ borderTop: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                onClick={() => navigate(`/research?symbol=${h.symbol}`)}>
                <td style={tableCellStyle}>
                  <span style={{ color: C.gold, fontWeight: 700 }}>{h.symbol}</span>
                </td>
                <td style={tableCellStyle}>{h._quantity.toFixed(4)}</td>
                <td style={tableCellStyle}>{fmt$(h._avgCost)}</td>
                <td style={tableCellStyle}>{fmt$(h._costBasis)}</td>
                <td style={tableCellStyle}>{fmt$(h._marketValue)}</td>
                <td style={{ ...tableCellStyle, color: h._unrealGain >= 0 ? C.green : C.red }}>
                  {fmt$(h._unrealGain)}
                </td>
                <td style={{ ...tableCellStyle, color: h._return >= 0 ? C.green : C.red }}>
                  {h._return >= 0 ? "+" : ""}{h._return.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Recent transactions */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <p style={labelStyle}>Ledger</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>Recent Transactions</h3>
          </div>
          {recentTx.length > 10 && (
            <button onClick={() => setShowAllTx(v => !v)} style={{
              background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: "8px", padding: "4px 14px", fontSize: "12px", cursor: "pointer",
            }}>
              {showAllTx ? "Show less" : `Show all ${recentTx.length}`}
            </button>
          )}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: "12px", textAlign: "left", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {["Date","Type","Asset","Qty","Price","Realized Gain"].map(h => (
                <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTx.map((tx: any) => {
              const isBuy = tx.transactionType === "BUY";
              const gain  = Number(tx.realizedGain);
              return (
                <tr key={tx.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                  <td style={tableCellStyle}>{new Date(tx.transactionDate + "T00:00:00").toLocaleDateString()}</td>
                  <td style={tableCellStyle}><span style={pillStyle(tx.transactionType)}>{tx.transactionType}</span></td>
                  <td style={{ ...tableCellStyle, color: C.gold, cursor: "pointer" }}
                    onClick={() => navigate(`/research?symbol=${tx.symbol}`)}>
                    {tx.symbol}
                  </td>
                  <td style={tableCellStyle}>{Number(tx.quantity).toFixed(4)}</td>
                  <td style={tableCellStyle}>{fmt$(Number(tx.pricePerUnit))}</td>
                  <td style={{ ...tableCellStyle, color: gain >= 0 ? C.green : C.red }}>
                    {isBuy ? <span style={{ color: C.muted }}>—</span> : fmt$(gain)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
