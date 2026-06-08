import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, PORTFOLIO_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

const SECTORS = ["Technology","Healthcare","Financials","Consumer Cyclical","Communication Services","Industrials","Energy","Utilities","Real Estate","Consumer Defensive","Basic Materials"];
const EXCHANGES = ["NASDAQ","NYSE","AMEX"];

export default function Discover() {
  const navigate = useNavigate();

  // Search state
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<any[]>([]);
  const [searching, setSearching]   = useState(false);
  const searchRef                   = useRef<number | null>(null);

  // Screener state
  const [sector, setSector]         = useState("");
  const [exchange, setExchange]     = useState("");
  const [minCap, setMinCap]         = useState("");
  const [screenerRows, setScreenerRows] = useState<any[]>([]);
  const [screening, setScreening]   = useState(false);

  // Preview state
  const [preview, setPreview]       = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [addMsg, setAddMsg]         = useState<string | null>(null);

  // Watchlists (for quick-add)
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [watchlistTarget, setWatchlistTarget] = useState<string>("");

  useEffect(() => {
    fetch(`${API}/watchlists?portfolioId=${PORTFOLIO_ID}`)
      .then(r => r.json()).then(setWatchlists).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    const q = query.trim();
    if (q.length < 1) { setResults([]); return; }
    setSearching(true);
    searchRef.current = window.setTimeout(() => {
      fetch(`${API}/fmp/search?query=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => { setResults(Array.isArray(d) ? d : []); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
  }, [query]);

  const runScreener = () => {
    setScreening(true);
    const params = new URLSearchParams();
    if (sector)   params.set("sector",           sector);
    if (exchange) params.set("exchange",          exchange);
    if (minCap)   params.set("marketCapMoreThan", (Number(minCap) * 1e9).toString());
    params.set("limit", "20");
    fetch(`${API}/fmp/screener?${params}`)
      .then(r => r.json())
      .then(d => { setScreenerRows(Array.isArray(d) ? d : []); setScreening(false); })
      .catch(() => setScreening(false));
  };

  const loadPreview = (symbol: string) => {
    setPreview(null);
    setAddMsg(null);
    setPreviewLoading(true);
    fetch(`${API}/fmp/preview/${symbol}`)
      .then(r => r.json())
      .then(d => { setPreview(d); setPreviewLoading(false); })
      .catch(() => setPreviewLoading(false));
  };

  const addToLibrary = async (symbol: string) => {
    setAddingSymbol(symbol);
    setAddMsg(null);
    try {
      const res = await fetch(`${API}/fmp/add-to-library/${symbol}`, { method: "POST" });
      const data = await res.json();
      setAddMsg(`✓ ${data.symbol} added to library`);
      if (preview?.symbol === symbol) setPreview({ ...preview, inLibrary: true });
    } catch {
      setAddMsg("Failed to add asset");
    } finally {
      setAddingSymbol(null);
    }
  };

  const addToWatchlist = async (symbol: string, watchlistId: string) => {
    if (!watchlistId) return;
    try {
      await fetch(`${API}/watchlists/${watchlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      setAddMsg(`✓ ${symbol} added to watchlist`);
    } catch {
      setAddMsg("Failed to add to watchlist");
    }
  };

  const fmt = (v: number | null) =>
    v == null ? "—" : v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v}`;

  const inputStyle: React.CSSProperties = {
    background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
    borderRadius: "10px", padding: "10px 14px", fontSize: "14px", fontFamily: C.font,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Asset Library</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Discover</h2>
      <p style={{ color: C.muted, marginBottom: "40px" }}>
        Search FMP's full universe, preview company data, and add assets to your library or watchlists.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: preview ? "1fr 360px" : "1fr", gap: "24px", alignItems: "start" }}>
        <div>
          {/* Search */}
          <section style={{ ...sectionStyle, marginBottom: "24px" }}>
            <p style={labelStyle}>Symbol Search</p>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by symbol or company name…"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: "20px", fontSize: "16px", padding: "14px 16px" }}
            />
            {searching && <p style={{ color: C.muted, marginTop: "12px", fontSize: "13px" }}>Searching…</p>}
            {!searching && results.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <th style={{ paddingBottom: "10px", textAlign: "left" }}>Symbol</th>
                    <th style={{ paddingBottom: "10px", textAlign: "left" }}>Name</th>
                    <th style={{ paddingBottom: "10px", textAlign: "left" }}>Exchange</th>
                    <th style={{ paddingBottom: "10px", textAlign: "left" }}>Currency</th>
                    <th style={{ paddingBottom: "10px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any) => (
                    <tr key={r.symbol} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                      <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 700 }}>{r.symbol}</td>
                      <td style={{ ...tableCellStyle, fontSize: "14px" }}>{r.name}</td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "13px" }}>{r.exchange}</td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "13px" }}>{r.currency}</td>
                      <td style={{ ...tableCellStyle, textAlign: "right" }}>
                        <button onClick={() => loadPreview(r.symbol)} style={{
                          background: "transparent", color: C.gold,
                          border: `1px solid rgba(200,169,106,0.4)`, borderRadius: "8px",
                          padding: "5px 14px", cursor: "pointer", fontFamily: C.font, fontSize: "12px",
                        }}>Preview</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Screener */}
          <section style={sectionStyle}>
            <p style={labelStyle}>Company Screener</p>
            <h3 style={{ fontSize: "22px", margin: "8px 0 24px" }}>Filter by fundamentals</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "20px" }}>
              <div>
                <p style={{ color: C.muted, fontSize: "12px", marginBottom: "6px" }}>Sector</p>
                <select value={sector} onChange={e => setSector(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
                  <option value="">Any sector</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <p style={{ color: C.muted, fontSize: "12px", marginBottom: "6px" }}>Exchange</p>
                <select value={exchange} onChange={e => setExchange(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
                  <option value="">Any exchange</option>
                  {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div>
                <p style={{ color: C.muted, fontSize: "12px", marginBottom: "6px" }}>Min Market Cap ($B)</p>
                <input type="number" value={minCap} onChange={e => setMinCap(e.target.value)}
                  placeholder="e.g. 10" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <button onClick={runScreener} disabled={screening} style={{
              background: C.gold, color: "#000", border: "none", borderRadius: "10px",
              padding: "10px 24px", fontWeight: 700, cursor: screening ? "not-allowed" : "pointer",
              fontFamily: C.font, opacity: screening ? 0.6 : 1,
            }}>{screening ? "Screening…" : "Run Screener"}</button>

            {screenerRows.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "28px" }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {["Symbol","Name","Sector","Exchange","Market Cap","Price","Beta",""].map(h => (
                      <th key={h} style={{ paddingBottom: "10px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screenerRows.map((r: any) => (
                    <tr key={r.symbol} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                      <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 700 }}>{r.symbol}</td>
                      <td style={{ ...tableCellStyle, fontSize: "13px" }}>{r.name}</td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>{r.sector}</td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "12px" }}>{r.exchange}</td>
                      <td style={tableCellStyle}>{fmt(r.marketCap)}</td>
                      <td style={tableCellStyle}>{r.price != null ? `$${Number(r.price).toFixed(2)}` : "—"}</td>
                      <td style={{ ...tableCellStyle, color: C.muted, fontSize: "13px" }}>{r.beta != null ? Number(r.beta).toFixed(2) : "—"}</td>
                      <td style={{ ...tableCellStyle, textAlign: "right" }}>
                        <button onClick={() => loadPreview(r.symbol)} style={{
                          background: "transparent", color: C.gold,
                          border: `1px solid rgba(200,169,106,0.4)`, borderRadius: "8px",
                          padding: "5px 14px", cursor: "pointer", fontFamily: C.font, fontSize: "12px",
                        }}>Preview</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* Preview panel */}
        {(previewLoading || preview) && (
          <aside style={{ position: "sticky", top: "24px" }}>
            <section style={{ ...sectionStyle, padding: "28px" }}>
              {previewLoading
                ? <p style={{ color: C.muted }}>Loading…</p>
                : preview && <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div>
                      <p style={{ color: C.muted, fontSize: "12px", margin: 0 }}>{preview.name}</p>
                      <h2 style={{ fontSize: "36px", margin: "4px 0 0", lineHeight: 1, color: C.gold }}>{preview.symbol}</h2>
                    </div>
                    <button onClick={() => setPreview(null)} style={{
                      background: "transparent", color: C.muted, border: `1px solid ${C.borderSubtle}`,
                      borderRadius: "999px", padding: "4px 12px", cursor: "pointer", fontFamily: C.font, fontSize: "12px",
                    }}>✕</button>
                  </div>

                  {/* Stats */}
                  {[
                    { label: "Type",       value: preview.assetType ?? "—" },
                    { label: "Exchange",   value: preview.exchange ?? "—" },
                    { label: "Sector",     value: preview.sector ?? "—" },
                    { label: "Industry",   value: preview.industry ?? "—" },
                    { label: "Market Cap", value: fmt(preview.marketCap) },
                    { label: "P/E Ratio",  value: preview.peRatio != null ? Number(preview.peRatio).toFixed(1) : "—" },
                    { label: "Price",      value: preview.price != null ? `$${Number(preview.price).toFixed(2)}` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.borderSubtle}` }}>
                      <span style={{ color: C.muted, fontSize: "13px" }}>{label}</span>
                      <span style={{ fontSize: "13px" }}>{value}</span>
                    </div>
                  ))}

                  {addMsg && <p style={{ color: C.green, fontSize: "12px", marginTop: "12px", marginBottom: 0 }}>{addMsg}</p>}

                  {/* Actions */}
                  <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button
                      onClick={() => addToLibrary(preview.symbol)}
                      disabled={!!addingSymbol || preview.inLibrary}
                      style={{
                        background: preview.inLibrary ? "rgba(143,214,148,0.1)" : C.gold,
                        color: preview.inLibrary ? C.green : "#000",
                        border: preview.inLibrary ? `1px solid ${C.green}` : "none",
                        borderRadius: "10px", padding: "10px", fontWeight: 700,
                        cursor: preview.inLibrary || addingSymbol ? "default" : "pointer",
                        fontFamily: C.font, fontSize: "13px", width: "100%",
                      }}
                    >
                      {addingSymbol === preview.symbol ? "Adding…" : preview.inLibrary ? "✓ In Library" : "+ Add to Library"}
                    </button>

                    <button onClick={() => navigate(`/research?symbol=${preview.symbol}`)} style={{
                      background: "transparent", color: C.gold, border: `1px solid rgba(200,169,106,0.4)`,
                      borderRadius: "10px", padding: "10px", cursor: "pointer",
                      fontFamily: C.font, fontSize: "13px", width: "100%",
                    }}>→ Open in Research</button>

                    {watchlists.length > 0 && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <select value={watchlistTarget} onChange={e => setWatchlistTarget(e.target.value)}
                          style={{ ...{ background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`, borderRadius: "10px", padding: "8px 10px", fontSize: "12px", fontFamily: C.font, flex: 1 } }}>
                          <option value="">Add to watchlist…</option>
                          {watchlists.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <button onClick={() => addToWatchlist(preview.symbol, watchlistTarget)}
                          disabled={!watchlistTarget}
                          style={{
                            background: "rgba(200,169,106,0.1)", color: C.gold,
                            border: `1px solid rgba(200,169,106,0.35)`, borderRadius: "10px",
                            padding: "8px 14px", cursor: watchlistTarget ? "pointer" : "default",
                            fontFamily: C.font, fontSize: "12px", opacity: watchlistTarget ? 1 : 0.5,
                          }}>Add</button>
                      </div>
                    )}
                  </div>
                </>
              }
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
