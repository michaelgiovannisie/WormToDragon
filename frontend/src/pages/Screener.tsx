import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

// ── types ──────────────────────────────────────────────────────────────────

interface ScreenerResult {
  symbol: string;
  name: string | null;
  sector: string | null;
  exchange: string | null;
  country: string | null;
  marketCap: number | null;
  price: number | null;
  beta: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;           // decimal, e.g. 0.25 = 25%
  netMargin: number | null;     // decimal
  dividendYield: number | null; // decimal
  debtEquity: number | null;
  piotroskiScore: number | null;
  altmanZScore: number | null;
}

// ── constants ──────────────────────────────────────────────────────────────

const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Consumer Cyclical",
  "Consumer Defensive", "Industrials", "Basic Materials", "Communication Services",
  "Energy", "Real Estate", "Utilities",
];

const EXCHANGES = ["NASDAQ", "NYSE", "AMEX", "LSE", "TSX", "HKEX", "ASX", "EURONEXT"];

const MARKET_CAP_TIERS: { label: string; more?: number; less?: number }[] = [
  { label: "Any" },
  { label: "Mega (>$200B)",      more: 200_000_000_000 },
  { label: "Large ($10B–$200B)", more: 10_000_000_000,  less: 200_000_000_000 },
  { label: "Mid ($2B–$10B)",     more: 2_000_000_000,   less: 10_000_000_000 },
  { label: "Small ($300M–$2B)",  more: 300_000_000,     less: 2_000_000_000 },
  { label: "Micro (<$300M)",                             less: 300_000_000 },
];

const PIOTROSKI_OPTIONS = [
  { label: "Any",            value: "" },
  { label: "≥5 Average",    value: "5" },
  { label: "≥7 Strong",     value: "7" },
  { label: "≥8 Very Strong", value: "8" },
];

// ── helpers ────────────────────────────────────────────────────────────────

function fmtCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRatio(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals) + "x";
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function piotroskiColor(v: number | null): string {
  if (v == null) return C.muted;
  if (v >= 7) return C.green;
  if (v >= 5) return C.gold;
  return C.red;
}

function roePctColor(v: number | null): string {
  if (v == null) return C.muted;
  const pct = v * 100;
  if (pct >= 15) return C.green;
  if (pct >= 8)  return C.gold;
  return C.red;
}

function peColor(v: number | null): string {
  if (v == null) return C.muted;
  if (v > 0 && v <= 15) return C.green;
  if (v > 0 && v <= 25) return C.gold;
  return C.red;
}

function altmanColor(v: number | null): string {
  if (v == null) return C.muted;
  if (v >= 3) return C.green;
  if (v >= 1.81) return C.gold;
  return C.red;
}

// ── sort hook ─────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

function useSortable<T>(rows: T[], defaultKey: keyof T) {
  const [key, setKey] = useState<keyof T>(defaultKey);
  const [dir, setDir] = useState<SortDir>("desc");

  function toggle(k: keyof T) {
    if (k === key) setDir(d => d === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("desc"); }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });

  return { sorted, sortKey: key, sortDir: dir, toggle };
}

// ── component ──────────────────────────────────────────────────────────────

export default function Screener() {
  const navigate = useNavigate();

  // ── Universe ──
  const [exchange,  setExchange]  = useState("");
  const [sector,    setSector]    = useState("");
  const [industry,  setIndustry]  = useState("");
  const [country,   setCountry]   = useState("");

  // ── Size / Price ──
  const [capTier,   setCapTier]   = useState(0);
  const [priceMin,  setPriceMin]  = useState("");
  const [priceMax,  setPriceMax]  = useState("");

  // ── Beta / Volume ──
  const [betaMin,   setBetaMin]   = useState("");
  const [betaMax,   setBetaMax]   = useState("");
  const [volMin,    setVolMin]    = useState("");
  const [volMax,    setVolMax]    = useState("");

  // ── Dividend (FMP-level, per-share) ──
  const [divMin,    setDivMin]    = useState("");
  const [divMax,    setDivMax]    = useState("");

  // ── Flags ──
  const [isEtf,               setIsEtf]               = useState<boolean | null>(false);
  const [isFund,              setIsFund]              = useState<boolean | null>(false);
  const [isActivelyTrading,   setIsActivelyTrading]   = useState<boolean | null>(true);
  const [inclAllShareClasses, setInclAllShareClasses] = useState<boolean | null>(null);

  // ── Enrichment post-filters ──
  const [maxPe,         setMaxPe]         = useState("");
  const [minRoe,        setMinRoe]        = useState("");  // user enters %
  const [minDivYield,   setMinDivYield]   = useState("");  // user enters %
  const [minPiotroski,  setMinPiotroski]  = useState("");

  // ── Limit ──
  const [limit, setLimit] = useState("50");

  // ── Results ──
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [hasRun,  setHasRun]  = useState(false);

  const { sorted, sortKey, sortDir, toggle } = useSortable(results, "marketCap");

  async function runScreen() {
    setLoading(true);
    setError(null);

    const tier = MARKET_CAP_TIERS[capTier];
    const p = new URLSearchParams();

    // Universe
    if (exchange)  p.set("exchange",  exchange);
    if (sector)    p.set("sector",    sector);
    if (industry)  p.set("industry",  industry);
    if (country)   p.set("country",   country);

    // Size / Price
    if (tier.more) p.set("marketCapMoreThan",  String(tier.more));
    if (tier.less) p.set("marketCapLowerThan", String(tier.less));
    if (priceMin)  p.set("priceMoreThan",  priceMin);
    if (priceMax)  p.set("priceLowerThan", priceMax);

    // Beta / Volume
    if (betaMin) p.set("betaMoreThan",   betaMin);
    if (betaMax) p.set("betaLowerThan",  betaMax);
    if (volMin)  p.set("volumeMoreThan", volMin);
    if (volMax)  p.set("volumeLowerThan",volMax);

    // Dividend (per-share, FMP-level)
    if (divMin) p.set("dividendMoreThan",  divMin);
    if (divMax) p.set("dividendLowerThan", divMax);

    // Flags
    if (isEtf !== null)               p.set("isEtf",               String(isEtf));
    if (isFund !== null)              p.set("isFund",              String(isFund));
    if (isActivelyTrading !== null)   p.set("isActivelyTrading",   String(isActivelyTrading));
    if (inclAllShareClasses !== null) p.set("includeAllShareClasses", String(inclAllShareClasses));

    // Enrichment
    if (maxPe)       p.set("maxPeRatio",       maxPe);
    if (minRoe)      p.set("minRoe",           String(Number(minRoe) / 100));
    if (minDivYield) p.set("minDividendYield", String(Number(minDivYield) / 100));
    if (minPiotroski) p.set("minPiotroski",    minPiotroski);

    p.set("limit", limit || "50");

    try {
      const res = await fetch(`${API}/fmp/screener/full?${p.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data: ScreenerResult[] = await res.json();
      setResults(data);
      setHasRun(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── styles ───────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    color: C.text,
    fontFamily: C.font,
    fontSize: "13px",
    padding: "6px 10px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

  const groupLabel: React.CSSProperties = {
    color: C.gold,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: "0 0 10px",
  };

  const fieldLabel: React.CSSProperties = {
    color: C.muted,
    fontSize: "12px",
    margin: "0 0 5px",
  };

  const th: React.CSSProperties = {
    color: C.muted,
    fontSize: "12px",
    fontWeight: 400,
    textAlign: "left",
    paddingBottom: "12px",
    borderBottom: `1px solid rgba(200,169,106,0.15)`,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  function SortTh({ col, label }: { col: keyof ScreenerResult; label: string }) {
    const active = sortKey === col;
    return (
      <th style={{ ...th, color: active ? C.gold : C.muted }} onClick={() => toggle(col)}>
        {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  // ── Flag tri-state: null = omit, true = checked, false = unchecked ────────
  function FlagCheck({
    label, value, onChange,
  }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
    // Click cycles: null → true → false → null
    function cycle() {
      if (value === null)  onChange(true);
      else if (value)      onChange(false);
      else                 onChange(null);
    }
    const display = value === null ? "—" : value ? "✓" : "✗";
    const color   = value === null ? C.muted : value ? C.green : C.red;
    return (
      <div
        onClick={cycle}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          cursor: "pointer", padding: "6px 10px",
          border: `1px solid ${C.border}`, borderRadius: "8px",
          background: "rgba(255,255,255,0.04)", userSelect: "none",
          fontSize: "13px",
        }}
      >
        <span style={{ color, fontWeight: 700, minWidth: "14px", textAlign: "center" }}>
          {display}
        </span>
        <span style={{ color: C.text }}>{label}</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1400px" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ color: C.gold, fontSize: "28px", margin: "0 0 8px", letterSpacing: "0.04em" }}>
          Screener
        </h2>
        <p style={{ color: C.muted, margin: 0, fontSize: "14px" }}>
          Filter global equities by fundamentals — click any result to open in Research
        </p>
      </div>

      {/* Filter panel */}
      <div style={{ ...sectionStyle, marginBottom: "24px" }}>
        <p style={{ ...labelStyle, margin: "0 0 20px" }}>Filters</p>

        {/* ── Universe ── */}
        <p style={groupLabel}>Universe</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "18px" }}>
          <div>
            <p style={fieldLabel}>Exchange</p>
            <select value={exchange} onChange={e => setExchange(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          <div>
            <p style={fieldLabel}>Sector</p>
            <select value={sector} onChange={e => setSector(e.target.value)} style={selectStyle}>
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <p style={fieldLabel}>Industry</p>
            <input
              type="text" placeholder="e.g. Software"
              value={industry} onChange={e => setIndustry(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Country</p>
            <input
              type="text" placeholder="e.g. US, GB, JP"
              value={country} onChange={e => setCountry(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Size / Price ── */}
        <p style={groupLabel}>Size &amp; Price</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px", marginBottom: "18px" }}>
          <div>
            <p style={fieldLabel}>Market Cap</p>
            <select value={capTier} onChange={e => setCapTier(Number(e.target.value))} style={selectStyle}>
              {MARKET_CAP_TIERS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <p style={fieldLabel}>Price Min ($)</p>
            <input
              type="number" min={0} placeholder="0"
              value={priceMin} onChange={e => setPriceMin(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Price Max ($)</p>
            <input
              type="number" min={0} placeholder="∞"
              value={priceMax} onChange={e => setPriceMax(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Limit</p>
            <input
              type="number" min={1} max={200} placeholder="50"
              value={limit} onChange={e => setLimit(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Beta / Volume ── */}
        <p style={groupLabel}>Beta &amp; Volume</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "18px" }}>
          <div>
            <p style={fieldLabel}>Beta Min</p>
            <input
              type="number" step={0.1} placeholder="0"
              value={betaMin} onChange={e => setBetaMin(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Beta Max</p>
            <input
              type="number" step={0.1} placeholder="∞"
              value={betaMax} onChange={e => setBetaMax(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Volume Min</p>
            <input
              type="number" min={0} placeholder="e.g. 1000000"
              value={volMin} onChange={e => setVolMin(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Volume Max</p>
            <input
              type="number" min={0} placeholder="∞"
              value={volMax} onChange={e => setVolMax(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Dividend (FMP-level, per-share) ── */}
        <p style={groupLabel}>Dividend (per share)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "18px" }}>
          <div>
            <p style={fieldLabel}>Div Min ($)</p>
            <input
              type="number" min={0} step={0.01} placeholder="0"
              value={divMin} onChange={e => setDivMin(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Div Max ($)</p>
            <input
              type="number" min={0} step={0.01} placeholder="∞"
              value={divMax} onChange={e => setDivMax(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Flags ── */}
        <p style={groupLabel}>Flags <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "11px" }}>(click to toggle: — ignore, ✓ require, ✗ exclude)</span></p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
          <FlagCheck label="ETF"                   value={isEtf}               onChange={setIsEtf} />
          <FlagCheck label="Fund"                  value={isFund}             onChange={setIsFund} />
          <FlagCheck label="Actively Trading"      value={isActivelyTrading}  onChange={setIsActivelyTrading} />
          <FlagCheck label="All Share Classes"     value={inclAllShareClasses} onChange={setInclAllShareClasses} />
        </div>

        {/* ── Enrichment post-filters ── */}
        <p style={groupLabel}>Quality Filters <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "11px" }}>(applied after enrichment — slower)</span></p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
          <div>
            <p style={fieldLabel}>Max P/E</p>
            <input
              type="number" min={0} placeholder="e.g. 25"
              value={maxPe} onChange={e => setMaxPe(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Min ROE %</p>
            <input
              type="number" min={0} placeholder="e.g. 15"
              value={minRoe} onChange={e => setMinRoe(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Min Div Yield %</p>
            <input
              type="number" min={0} step={0.1} placeholder="e.g. 2"
              value={minDivYield} onChange={e => setMinDivYield(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <p style={fieldLabel}>Min Piotroski</p>
            <select value={minPiotroski} onChange={e => setMinPiotroski(e.target.value)} style={selectStyle}>
              {PIOTROSKI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Screen button */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={runScreen}
            disabled={loading}
            style={{
              background: loading ? "rgba(200,169,106,0.4)" : C.gold,
              color: "#0B1020",
              border: "none",
              borderRadius: "8px",
              fontFamily: C.font,
              fontSize: "14px",
              fontWeight: 700,
              padding: "9px 28px",
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {loading ? "Screening…" : "Screen"}
          </button>
          {error && <span style={{ color: C.red, fontSize: "13px" }}>{error}</span>}
        </div>
      </div>

      {/* Results */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <p style={{ ...labelStyle, margin: 0 }}>Results</p>
          {hasRun && (
            <span style={{ color: C.muted, fontSize: "13px" }}>
              {results.length} {results.length === 1 ? "match" : "matches"}
            </span>
          )}
        </div>

        {!hasRun && !loading && (
          <p style={{ color: C.muted, fontSize: "14px", textAlign: "center", padding: "40px 0" }}>
            Set your filters above and click Screen
          </p>
        )}

        {hasRun && results.length === 0 && !loading && (
          <p style={{ color: C.muted, fontSize: "14px", textAlign: "center", padding: "40px 0" }}>
            No results matched your filters
          </p>
        )}

        {results.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
              <thead>
                <tr>
                  <SortTh col="symbol"        label="Symbol" />
                  <th style={th}>Company</th>
                  <SortTh col="sector"        label="Sector" />
                  <SortTh col="exchange"      label="Exch" />
                  <SortTh col="price"         label="Price" />
                  <SortTh col="marketCap"     label="Mkt Cap" />
                  <SortTh col="beta"          label="Beta" />
                  <SortTh col="peRatio"       label="P/E" />
                  <SortTh col="pbRatio"       label="P/B" />
                  <SortTh col="roe"           label="ROE" />
                  <SortTh col="netMargin"     label="Net Margin" />
                  <SortTh col="dividendYield" label="Div Yield" />
                  <SortTh col="debtEquity"    label="D/E" />
                  <SortTh col="piotroskiScore" label="Piotroski" />
                  <SortTh col="altmanZScore"  label="Altman Z" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr
                    key={row.symbol}
                    onClick={() => navigate(`/research?symbol=${row.symbol}`)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,169,106,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 600 }}>
                      {row.symbol}
                    </td>
                    <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.name ?? "—"}
                    </td>
                    <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                      {row.sector ?? "—"}
                    </td>
                    <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>
                      {row.exchange ?? "—"}
                    </td>
                    <td style={tableCellStyle}>{fmtPrice(row.price)}</td>
                    <td style={{ ...tableCellStyle, color: C.muted }}>{fmtCap(row.marketCap)}</td>
                    <td style={{ ...tableCellStyle, color: row.beta != null ? (Math.abs(row.beta) <= 1 ? C.green : Math.abs(row.beta) <= 1.5 ? C.gold : C.red) : C.muted }}>
                      {fmtNum(row.beta, 2)}
                    </td>
                    <td style={{ ...tableCellStyle, color: peColor(row.peRatio) }}>
                      {row.peRatio != null && row.peRatio > 0 ? fmtRatio(row.peRatio) : "—"}
                    </td>
                    <td style={tableCellStyle}>
                      {row.pbRatio != null && row.pbRatio > 0 ? fmtRatio(row.pbRatio) : "—"}
                    </td>
                    <td style={{ ...tableCellStyle, color: roePctColor(row.roe) }}>{fmtPct(row.roe)}</td>
                    <td style={{ ...tableCellStyle, color: row.netMargin != null && row.netMargin > 0 ? C.green : row.netMargin != null ? C.red : C.muted }}>
                      {fmtPct(row.netMargin)}
                    </td>
                    <td style={{ ...tableCellStyle, color: row.dividendYield != null && row.dividendYield > 0 ? C.text : C.muted }}>
                      {row.dividendYield != null && row.dividendYield > 0 ? fmtPct(row.dividendYield) : "—"}
                    </td>
                    <td style={{ ...tableCellStyle, color: row.debtEquity != null ? (row.debtEquity <= 1 ? C.green : row.debtEquity <= 2 ? C.gold : C.red) : C.muted }}>
                      {fmtNum(row.debtEquity, 2)}
                    </td>
                    <td style={{ ...tableCellStyle, fontWeight: 600, color: piotroskiColor(row.piotroskiScore) }}>
                      {row.piotroskiScore != null ? `${row.piotroskiScore}/9` : "—"}
                    </td>
                    <td style={{ ...tableCellStyle, color: altmanColor(row.altmanZScore) }}>
                      {fmtNum(row.altmanZScore, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
