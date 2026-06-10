import { useEffect, useState } from "react";
import { API, PORTFOLIO_ID, ACCOUNT_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

// ── types ──────────────────────────────────────────────────────────────────

interface PortfolioValueResponse {
  date: string;
  totalValue: number;
}

interface HistoricalPriceEntry {
  priceDate: string;
  close: number;
}

interface YearRow {
  year: number | "Current";
  endDate: string;
  portfolioValue: number | null;
  portfolioPct: number | null;  // TWR for the period
  benchmarkPct: number | null;
}

interface CagrRow {
  label: string;
  portfolioCagr: number | null;
  benchmarkCagr: number | null;
}

// ── helpers ────────────────────────────────────────────────────────────────

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function closestOnOrBefore(prices: HistoricalPriceEntry[], dateStr: string): number | null {
  const sorted = [...prices]
    .filter(p => p.priceDate <= dateStr)
    .sort((a, b) => b.priceDate.localeCompare(a.priceDate));
  return sorted.length > 0 ? sorted[0].close : null;
}

/**
 * Time-Weighted Return for a single period.
 *
 * startDate  — anchor date whose value is the starting portfolio value (after any
 *              cash flow already included on that day, e.g. first-tx date or Dec 31)
 * endDate    — last date of the period (e.g. Dec 31 or today)
 * txDates    — unique transaction dates that fall STRICTLY between startDate and endDate,
 *              sorted ascending. Each represents a cash-flow event.
 *
 * Sub-period structure:
 *   [startDate → prevDay(txDates[0])]  growth before first cash flow
 *   [txDates[0] → prevDay(txDates[1])] growth after first cash flow, before second
 *   ...
 *   [txDates[n] → endDate]             growth after last cash flow to period end
 *
 * TWR = product of (v_end / v_start) for each sub-period − 1
 */
function computeTWR(
  startDate: string,
  endDate: string,
  txDates: string[],
  pv: Map<string, number>
): number | null {
  const vStart = pv.get(startDate);
  if (!vStart) return null;

  // Build (afterCashFlow, beforeNextCashFlow) pairs
  const afterDates  = [startDate, ...txDates];
  const beforeDates = [...txDates.map(prevDay), endDate];

  let product = 1;
  for (let i = 0; i < afterDates.length; i++) {
    const v0 = pv.get(afterDates[i]);
    const v1 = pv.get(beforeDates[i]);
    if (!v0 || !v1) continue; // skip sub-period if data missing
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
  const [benchmarkSymbol, setBenchmarkSymbol] = useState("SPY");

  const [yearRows, setYearRows] = useState<YearRow[]>([]);
  const [cagrRows, setCagrRows] = useState<CagrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData(benchmarkSymbol);
  }, [benchmarkSymbol]);

  async function loadData(symbol: string) {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all transactions to get unique tx dates
      const txRes = await fetch(`${API}/transactions/account/${ACCOUNT_ID}`);
      if (!txRes.ok) throw new Error("Failed to fetch transactions");
      const txData: { transactionDate: string }[] = await txRes.json();

      if (txData.length === 0) {
        setYearRows([]);
        setCagrRows([]);
        return;
      }

      const uniqueTxDates = [...new Set(txData.map(t => t.transactionDate))].sort();
      const firstTxDate   = uniqueTxDates[0];
      const firstYear     = parseInt(firstTxDate.slice(0, 4));
      const today         = new Date();
      const todayStr      = today.toISOString().slice(0, 10);
      const currentYear   = today.getFullYear();
      const lastFullYear  = currentYear - 1;

      // 2. Build the full set of dates to fetch for TWR:
      //    - firstTxDate (inception anchor)
      //    - Dec 31 of each full year
      //    - today
      //    - every unique tx date (after-cash-flow anchor)
      //    - day before every unique tx date (before-cash-flow anchor)
      const datesToFetch = new Set<string>();
      datesToFetch.add(firstTxDate);
      for (let y = firstYear; y <= lastFullYear; y++) datesToFetch.add(`${y}-12-31`);
      datesToFetch.add(todayStr);
      for (const d of uniqueTxDates) {
        datesToFetch.add(d);
        datesToFetch.add(prevDay(d));
      }

      // 3. Fetch all portfolio values in parallel
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

      // 4. Fetch benchmark historical prices
      const bmRes = await fetch(`${API}/historical-prices/${symbol}`);
      if (!bmRes.ok) throw new Error(`Failed to fetch benchmark prices for ${symbol}`);
      const bmPrices: HistoricalPriceEntry[] = await bmRes.json();

      // 5. Build year rows using TWR for portfolio, simple return for benchmark
      const rows: YearRow[] = [];

      const buildRow = (
        year: number | "Current",
        startDate: string,
        endDate: string
      ): YearRow => {
        // Tx dates strictly between startDate and endDate
        const txInPeriod = uniqueTxDates.filter(d => d > startDate && d <= endDate);

        const portfolioPct  = computeTWR(startDate, endDate, txInPeriod, pv);
        const startBm       = closestOnOrBefore(bmPrices, startDate);
        const endBm         = closestOnOrBefore(bmPrices, endDate);
        const benchmarkPct  = startBm && endBm ? ((endBm - startBm) / startBm) * 100 : null;
        const portfolioValue = pv.get(endDate) ?? null;

        return { year, endDate, portfolioValue, portfolioPct, benchmarkPct };
      };

      for (let y = firstYear; y <= lastFullYear; y++) {
        const startDate = y === firstYear ? firstTxDate : `${y - 1}-12-31`;
        rows.push(buildRow(y, startDate, `${y}-12-31`));
      }

      // Current partial year
      {
        const startDate = currentYear === firstYear ? firstTxDate : `${lastFullYear}-12-31`;
        rows.push(buildRow("Current", startDate, todayStr));
      }

      setYearRows(rows);

      // 6. CAGR — chain-link TWR across years, annualise
      //    For portfolio: use chain-linked TWRs (already TWR per year)
      //    For benchmark: simple price return annualised
      const cagrResults: CagrRow[] = [];

      function portfolioCAGR(fromDate: string, toDate: string): number | null {
        // Build year rows for the period and chain-link
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

      function benchmarkCAGR(fromDate: string, toDate: string): number | null {
        const vStart = closestOnOrBefore(bmPrices, fromDate);
        const vEnd   = closestOnOrBefore(bmPrices, toDate);
        if (!vStart || !vEnd) return null;
        const years = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (years <= 0) return null;
        return (Math.pow(vEnd / vStart, 1 / years) - 1) * 100;
      }

      cagrResults.push({
        label: "Since Inception",
        portfolioCagr:  portfolioCAGR(firstTxDate, todayStr),
        benchmarkCagr:  benchmarkCAGR(firstTxDate, todayStr),
      });

      const date3yr = `${currentYear - 3}-12-31`;
      if (date3yr >= firstTxDate) {
        cagrResults.push({
          label: "3-Year",
          portfolioCagr:  portfolioCAGR(date3yr, todayStr),
          benchmarkCagr:  benchmarkCAGR(date3yr, todayStr),
        });
      }

      const date1yr = `${lastFullYear}-12-31`;
      if (date1yr >= firstTxDate) {
        cagrResults.push({
          label: "1-Year",
          portfolioCagr:  portfolioCAGR(date1yr, todayStr),
          benchmarkCagr:  benchmarkCAGR(date1yr, todayStr),
        });
      }

      setCagrRows(cagrResults);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
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
        <span style={labelStyle}>Benchmark</span>
        <input
          value={benchmarkInput}
          onChange={e => setBenchmarkInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") setBenchmarkSymbol(benchmarkInput); }}
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
          onClick={() => setBenchmarkSymbol(benchmarkInput)}
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
          Load
        </button>
        {loading && <span style={{ color: C.muted, fontSize: "13px" }}>Loading…</span>}
        {error && <span style={{ color: C.red, fontSize: "13px" }}>{error}</span>}
      </div>

      {/* Year-by-year table */}
      <div style={{ ...sectionStyle, marginBottom: "28px" }}>
        <p style={{ ...labelStyle, margin: "0 0 20px" }}>Year-by-Year Returns (TWR)</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Year", "Portfolio Value", "Portfolio %", `${benchmarkSymbol} %`, "Difference"].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearRows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ ...tableCellStyle, color: C.muted, textAlign: "center", paddingTop: "32px" }}>
                  No data available
                </td>
              </tr>
            )}
            {yearRows.map(row => {
              const diff = row.portfolioPct !== null && row.benchmarkPct !== null
                ? row.portfolioPct - row.benchmarkPct
                : null;
              return (
                <tr key={String(row.year)}>
                  <td style={{ ...tableCellStyle, color: C.gold }}>{row.year}</td>
                  <td style={tableCellStyle}>{fmtVal(row.portfolioValue)}</td>
                  <td style={{ ...tableCellStyle, color: diffColor(row.portfolioPct) }}>{fmtPct(row.portfolioPct)}</td>
                  <td style={tableCellStyle}>{fmtPct(row.benchmarkPct)}</td>
                  <td style={{ ...tableCellStyle, color: diffColor(diff), fontWeight: diff !== null ? 600 : 400 }}>
                    {fmtPct(diff)}
                  </td>
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
              {["Period", "Portfolio CAGR", `${benchmarkSymbol} CAGR`, "Alpha"].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cagrRows.map(row => {
              const alpha = row.portfolioCagr !== null && row.benchmarkCagr !== null
                ? row.portfolioCagr - row.benchmarkCagr
                : null;
              return (
                <tr key={row.label}>
                  <td style={{ ...tableCellStyle, color: C.gold }}>{row.label}</td>
                  <td style={{ ...tableCellStyle, color: diffColor(row.portfolioCagr) }}>
                    {fmtPct(row.portfolioCagr)}
                  </td>
                  <td style={tableCellStyle}>{fmtPct(row.benchmarkCagr)}</td>
                  <td style={{ ...tableCellStyle, color: diffColor(alpha), fontWeight: 600 }}>
                    {fmtPct(alpha)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
