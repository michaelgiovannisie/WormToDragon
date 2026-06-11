import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { API, PORTFOLIO_ID, ACCOUNT_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle, tooltipStyle } from "../theme";

// ── types ──────────────────────────────────────────────────────────────────

interface PortfolioValueResponse {
  date: string;
  totalValue: number;
}

interface HistoricalPriceEntry {
  priceDate: string;
  close: number;
}

interface ChartPoint {
  date: string;
  portfolio: number;
  benchmark?: number;
}

interface YearRow {
  year: number | "Current";
  endDate: string;
  portfolioValue: number | null;
  portfolioPct: number | null;
  benchmarkPct: number | null;
}

interface CagrRow {
  label: string;
  portfolioCagr: number | null;
  benchmarkCagr: number | null;
}

// Cached portfolio data so benchmark load doesn't re-fetch everything
interface PortfolioCache {
  pv: Map<string, number>;
  uniqueTxDates: string[];
  firstTxDate: string;
  firstYear: number;
  lastFullYear: number;
  currentYear: number;
  todayStr: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function closestOnOrBefore(prices: HistoricalPriceEntry[], dateStr: string): number | null {
  const sorted = [...prices]
    .filter(p => p.priceDate <= dateStr)
    .sort((a, b) => b.priceDate.localeCompare(a.priceDate));
  return sorted.length > 0 ? sorted[0].close : null;
}

function computeTWR(
  startDate: string,
  endDate: string,
  txDates: string[],
  pv: Map<string, number>
): number | null {
  const vStart = pv.get(startDate);
  if (!vStart) return null;
  const afterDates  = [startDate, ...txDates];
  const beforeDates = [...txDates.map(prevDay), endDate];
  let product = 1;
  for (let i = 0; i < afterDates.length; i++) {
    const v0 = pv.get(afterDates[i]);
    const v1 = pv.get(beforeDates[i]);
    if (!v0 || !v1) continue;
    product *= v1 / v0;
  }
  return (product - 1) * 100;
}

function fmtPct(v: number | null): string {
  if (v === null) return "N/A";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function fmtVal(v: number | null): string {
  if (v === null) return "N/A";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function diffColor(v: number | null): string {
  if (v === null) return C.muted;
  if (v > 0) return C.green;
  if (v < 0) return C.red;
  return C.gold;
}

// ── component ──────────────────────────────────────────────────────────────

export default function Benchmarking() {
  const [benchmarkInput, setBenchmarkInput] = useState("SPY");
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string | null>(null);

  const [yearRows, setYearRows]   = useState<YearRow[]>([]);
  const [cagrRows, setCagrRows]   = useState<CagrRow[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<PortfolioCache | null>(null);

  // ── portfolio load (on mount) ──────────────────────────────────────────

  useEffect(() => {
    loadPortfolioData();
  }, []);

  async function loadPortfolioData() {
    setLoadingPortfolio(true);
    setError(null);
    try {
      const txRes = await fetch(`${API}/transactions/account/${ACCOUNT_ID}`);
      if (!txRes.ok) throw new Error("Failed to fetch transactions");
      const txData: { transactionDate: string }[] = await txRes.json();
      if (txData.length === 0) return;

      const uniqueTxDates = [...new Set(txData.map(t => t.transactionDate))].sort();
      const firstTxDate   = uniqueTxDates[0];
      const firstYear     = parseInt(firstTxDate.slice(0, 4));
      const today         = new Date();
      const todayStr      = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const currentYear   = today.getFullYear();
      const lastFullYear  = currentYear - 1;

      const datesToFetch = new Set<string>();
      datesToFetch.add(firstTxDate);
      for (let y = firstYear; y <= lastFullYear; y++) datesToFetch.add(`${y}-12-31`);
      datesToFetch.add(todayStr);
      for (const d of uniqueTxDates) {
        datesToFetch.add(d);
        datesToFetch.add(prevDay(d));
      }

      const pv = new Map<string, number>();
      await Promise.all(
        Array.from(datesToFetch).map(async d => {
          const res = await fetch(`${API}/portfolio/${PORTFOLIO_ID}/benchmarking/value?date=${d}`);
          if (res.ok) {
            const data: PortfolioValueResponse = await res.json();
            if (data.totalValue > 0) pv.set(d, data.totalValue);
          }
        })
      );

      cache.current = { pv, uniqueTxDates, firstTxDate, firstYear, lastFullYear, currentYear, todayStr };

      // Portfolio-only helpers
      function portfolioCAGR(fromDate: string, toDate: string): number | null {
        const fromYear = parseInt(fromDate.slice(0, 4));
        const toYear   = parseInt(toDate.slice(0, 4));
        let product = 1;
        for (let y = fromYear; y <= toYear; y++) {
          const sd = y === fromYear ? fromDate : `${y - 1}-12-31`;
          const ed = y === toYear   ? toDate   : `${y}-12-31`;
          const txInPeriod = uniqueTxDates.filter(d => d > sd && d <= ed);
          const twr = computeTWR(sd, ed, txInPeriod, pv);
          if (twr === null) return null;
          product *= (1 + twr / 100);
        }
        const years = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (years <= 0) return null;
        return (Math.pow(product, 1 / years) - 1) * 100;
      }

      // Year rows (benchmark columns null until user loads one)
      const rows: YearRow[] = [];
      for (let y = firstYear; y <= lastFullYear; y++) {
        const startDate = y === firstYear ? firstTxDate : `${y - 1}-12-31`;
        const endDate   = `${y}-12-31`;
        const txInPeriod = uniqueTxDates.filter(d => d > startDate && d <= endDate);
        rows.push({
          year: y, endDate,
          portfolioValue: pv.get(endDate) ?? null,
          portfolioPct: computeTWR(startDate, endDate, txInPeriod, pv),
          benchmarkPct: null,
        });
      }
      const curStart = currentYear === firstYear ? firstTxDate : `${lastFullYear}-12-31`;
      rows.push({
        year: "Current", endDate: todayStr,
        portfolioValue: pv.get(todayStr) ?? null,
        portfolioPct: computeTWR(curStart, todayStr, uniqueTxDates.filter(d => d > curStart && d <= todayStr), pv),
        benchmarkPct: null,
      });
      setYearRows(rows);

      // Chart — portfolio only
      const chartPoints: ChartPoint[] = [];
      for (let y = firstYear; y <= lastFullYear; y++) {
        const pc = portfolioCAGR(firstTxDate, `${y}-12-31`);
        if (pc !== null) chartPoints.push({ date: String(y), portfolio: Math.round(pc * 10) / 10 });
      }
      const pcNow = portfolioCAGR(firstTxDate, todayStr);
      if (pcNow !== null) chartPoints.push({ date: "Now", portfolio: Math.round(pcNow * 10) / 10 });
      setChartData(chartPoints);

      // CAGR rows — benchmark columns null
      const cagrResults: CagrRow[] = [];
      cagrResults.push({ label: "Since Inception", portfolioCagr: portfolioCAGR(firstTxDate, todayStr), benchmarkCagr: null });
      const date3yr = `${currentYear - 3}-12-31`;
      if (date3yr >= firstTxDate) cagrResults.push({ label: "3-Year", portfolioCagr: portfolioCAGR(date3yr, todayStr), benchmarkCagr: null });
      const date1yr = `${lastFullYear}-12-31`;
      if (date1yr >= firstTxDate) cagrResults.push({ label: "YTD", portfolioCagr: portfolioCAGR(date1yr, todayStr), benchmarkCagr: null });
      setCagrRows(cagrResults);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoadingPortfolio(false);
    }
  }

  // ── benchmark load (on demand) ─────────────────────────────────────────

  async function loadBenchmark(symbol: string) {
    if (!cache.current) { setError("Portfolio data is still loading — please wait."); return; }
    const { pv, uniqueTxDates, firstTxDate, firstYear, lastFullYear, currentYear, todayStr } = cache.current;

    setLoadingBenchmark(true);
    setError(null);
    try {
      const bmRes = await fetch(`${API}/historical-prices/${symbol}`);
      if (!bmRes.ok) throw new Error(`Failed to fetch prices for ${symbol}`);
      const bmPrices: HistoricalPriceEntry[] = await bmRes.json();

      function benchmarkCAGR(fromDate: string, toDate: string): number | null {
        const vStart = closestOnOrBefore(bmPrices, fromDate);
        const vEnd   = closestOnOrBefore(bmPrices, toDate);
        if (!vStart || !vEnd) return null;
        const years = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (years <= 0) return null;
        return (Math.pow(vEnd / vStart, 1 / years) - 1) * 100;
      }

      // Update chart with benchmark overlay
      setChartData(prev => prev.map(pt => {
        const toDate = pt.date === "Now" ? todayStr : `${pt.date}-12-31`;
        const bc = benchmarkCAGR(firstTxDate, toDate);
        return { ...pt, benchmark: bc !== null ? Math.round(bc * 10) / 10 : undefined };
      }));

      // Update year rows with benchmark %
      setYearRows(prev => prev.map(row => {
        const startDate = row.year === firstYear ? firstTxDate
          : row.year === "Current" ? (currentYear === firstYear ? firstTxDate : `${lastFullYear}-12-31`)
          : `${(row.year as number) - 1}-12-31`;
        const startBm = closestOnOrBefore(bmPrices, startDate);
        const endBm   = closestOnOrBefore(bmPrices, row.endDate);
        return {
          ...row,
          benchmarkPct: startBm && endBm ? ((endBm - startBm) / startBm) * 100 : null,
        };
      }));

      // Update CAGR rows with benchmark
      setCagrRows(prev => prev.map(row => {
        const fromDate = row.label === "Since Inception" ? firstTxDate
          : row.label === "3-Year" ? `${currentYear - 3}-12-31`
          : `${lastFullYear}-12-31`;
        return { ...row, benchmarkCagr: benchmarkCAGR(fromDate, todayStr) };
      }));

      setBenchmarkSymbol(symbol);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoadingBenchmark(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  const th: React.CSSProperties = {
    color: C.muted,
    fontSize: "13px",
    fontWeight: 400,
    textAlign: "left",
    paddingBottom: "12px",
    borderBottom: `1px solid rgba(200,169,106,0.15)`,
  };

  const hasBenchmark = benchmarkSymbol !== null;

  return (
    <div style={{ maxWidth: "960px" }}>
      {/* Header */}
      <div style={{ marginBottom: "36px" }}>
        <h2 style={{ color: C.gold, fontSize: "28px", margin: "0 0 8px", letterSpacing: "0.04em" }}>
          Benchmarking
        </h2>
        <p style={{ color: C.muted, margin: 0, fontSize: "14px" }}>
          Time-weighted returns vs benchmark — contributions excluded from performance
        </p>
      </div>

      {/* Benchmark input */}
      <div style={{ ...sectionStyle, marginBottom: "28px", display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={labelStyle}>Compare vs</span>
        <input
          value={benchmarkInput}
          onChange={e => setBenchmarkInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") loadBenchmark(benchmarkInput.trim()); }}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            color: C.text,
            fontFamily: C.font,
            fontSize: "15px",
            padding: "8px 14px",
            width: "100px",
            outline: "none",
          }}
          placeholder="e.g. SPY"
        />
        <button
          onClick={() => loadBenchmark(benchmarkInput.trim())}
          style={{
            background: C.gold,
            color: "#0B1020",
            border: "none",
            borderRadius: "8px",
            fontFamily: C.font,
            fontSize: "14px",
            fontWeight: 700,
            padding: "8px 20px",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          Compare
        </button>
        {hasBenchmark && (
          <button
            onClick={() => {
              setBenchmarkSymbol(null);
              setChartData(prev => prev.map(({ benchmark: _b, ...rest }) => rest));
              setYearRows(prev => prev.map(r => ({ ...r, benchmarkPct: null })));
              setCagrRows(prev => prev.map(r => ({ ...r, benchmarkCagr: null })));
            }}
            style={{
              background: "transparent",
              color: C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              fontFamily: C.font,
              fontSize: "14px",
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
        {(loadingPortfolio || loadingBenchmark) && <span style={{ color: C.muted, fontSize: "13px" }}>Loading…</span>}
        {error && <span style={{ color: C.red, fontSize: "13px" }}>{error}</span>}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ ...sectionStyle, marginBottom: "28px" }}>
          <p style={{ ...labelStyle, margin: "0 0 20px" }}>CAGR Since Inception (%)</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,169,106,0.08)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [
                  `${value > 0 ? "+" : ""}${value}%`,
                  name === "portfolio" ? "Portfolio" : benchmarkSymbol ?? name,
                ]}
                labelFormatter={l => l}
              />
              <Line type="monotone" dataKey="portfolio" stroke={C.green} strokeWidth={2} dot={{ r: 3, fill: C.green }} name="portfolio" />
              {hasBenchmark && (
                <Line type="monotone" dataKey="benchmark" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: "#60a5fa" }} strokeDasharray="5 3" name="benchmark" />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: C.muted }}>
              <span style={{ width: "16px", height: "2px", background: C.green, display: "inline-block" }} />
              Portfolio
            </span>
            {hasBenchmark && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: C.muted }}>
                <span style={{ width: "16px", height: "2px", background: "#60a5fa", display: "inline-block" }} />
                {benchmarkSymbol}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Year-by-year table */}
      <div style={{ ...sectionStyle, marginBottom: "28px" }}>
        <p style={{ ...labelStyle, margin: "0 0 20px" }}>Year-by-Year Returns (TWR)</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Year", "Portfolio Value", "Portfolio %", ...(hasBenchmark ? [`${benchmarkSymbol} %`, "Difference"] : [])].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearRows.length === 0 && !loadingPortfolio && (
              <tr>
                <td colSpan={hasBenchmark ? 5 : 3} style={{ ...tableCellStyle, color: C.muted, textAlign: "center", paddingTop: "32px" }}>
                  No data available
                </td>
              </tr>
            )}
            {yearRows.map(row => {
              const diff = row.portfolioPct !== null && row.benchmarkPct !== null
                ? row.portfolioPct - row.benchmarkPct : null;
              return (
                <tr key={String(row.year)}>
                  <td style={{ ...tableCellStyle, color: C.gold }}>{row.year}</td>
                  <td style={tableCellStyle}>{fmtVal(row.portfolioValue)}</td>
                  <td style={{ ...tableCellStyle, color: diffColor(row.portfolioPct) }}>{fmtPct(row.portfolioPct)}</td>
                  {hasBenchmark && <td style={tableCellStyle}>{fmtPct(row.benchmarkPct)}</td>}
                  {hasBenchmark && <td style={{ ...tableCellStyle, color: diffColor(diff), fontWeight: diff !== null ? 600 : 400 }}>{fmtPct(diff)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CAGR summary */}
      <div style={sectionStyle}>
        <p style={{ ...labelStyle, margin: "0 0 20px" }}>CAGR Summary</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Period", "Portfolio CAGR", ...(hasBenchmark ? [`${benchmarkSymbol} CAGR`, "Alpha"] : [])].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cagrRows.map(row => {
              const alpha = row.portfolioCagr !== null && row.benchmarkCagr !== null
                ? row.portfolioCagr - row.benchmarkCagr : null;
              return (
                <tr key={row.label}>
                  <td style={{ ...tableCellStyle, color: C.gold }}>{row.label}</td>
                  <td style={{ ...tableCellStyle, color: diffColor(row.portfolioCagr) }}>{fmtPct(row.portfolioCagr)}</td>
                  {hasBenchmark && <td style={tableCellStyle}>{fmtPct(row.benchmarkCagr)}</td>}
                  {hasBenchmark && <td style={{ ...tableCellStyle, color: diffColor(alpha), fontWeight: 600 }}>{fmtPct(alpha)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
