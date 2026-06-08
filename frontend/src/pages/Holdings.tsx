import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { API, PORTFOLIO_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

type SortKey = "symbol" | "marketValue" | "unrealizedGain" | "quantityHeld" | "averageCostBasis" | "dayChangePct";

function holdingPeriod(firstBuyDate: string | null): string {
  if (!firstBuyDate) return "—";
  const start = new Date(firstBuyDate + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}m`;
  if (rem === 0) return `${years}y`;
  return `${years}y ${rem}m`;
}

export default function Holdings() {
  const navigate = useNavigate();

  // ── Holdings ──────────────────────────────────────────────
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>(null);
  const [sortKey, setSortKey]   = useState<SortKey>("symbol");
  const [sortAsc, setSortAsc]   = useState(true);

  useEffect(() => {
    fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}`)
      .then(r => r.json()).then(setHoldings).catch(console.error);
    fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}/summary`)
      .then(r => r.json()).then(setSummary).catch(console.error);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...holdings].sort((a, b) => {
    const av = typeof a[sortKey] === "string" ? a[sortKey] : Number(a[sortKey] ?? 0);
    const bv = typeof b[sortKey] === "string" ? b[sortKey] : Number(b[sortKey] ?? 0);
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const totalReturn = summary?.totalCostBasis > 0
    ? ((Number(summary?.totalMarketValue) - Number(summary?.totalCostBasis)) / Number(summary?.totalCostBasis) * 100).toFixed(2)
    : "0.00";

  const summaryCards = [
    { label: "Total Cost Basis",   value: `$${Number(summary?.totalCostBasis ?? 0).toLocaleString("en-US",{minimumFractionDigits:2})}` },
    { label: "Total Market Value", value: `$${Number(summary?.totalMarketValue ?? 0).toLocaleString("en-US",{minimumFractionDigits:2})}` },
    { label: "Unrealized Gain",    value: `$${Number(summary?.totalUnrealizedGain ?? 0).toLocaleString("en-US",{minimumFractionDigits:2})}`, color: Number(summary?.totalUnrealizedGain ?? 0) >= 0 ? C.green : C.red },
    { label: "Total Return",       value: `${Number(totalReturn) >= 0 ? "+" : ""}${totalReturn}%`, color: Number(totalReturn) >= 0 ? C.green : C.red },
  ];

  const th = (key: SortKey | null, label: string): React.CSSProperties => ({
    paddingBottom: "12px", cursor: key ? "pointer" : "default",
    color: key && sortKey === key ? C.gold : C.muted,
    fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em",
    userSelect: "none", whiteSpace: "normal", lineHeight: "1.3", verticalAlign: "bottom", textAlign: "center",
  });
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  // ── Watchlists ────────────────────────────────────────────
  const [watchlists, setWatchlists]       = useState<any[]>([]);
  const [active, setActive]               = useState<any>(null);
  const [newName, setNewName]             = useState("");
  const [creating, setCreating]           = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addingSymbol, setAddingSymbol]   = useState<string | null>(null);
  const [renaming, setRenaming]           = useState<string | null>(null);
  const [renameVal, setRenameVal]         = useState("");

  const loadLists = () =>
    fetch(`${API}/watchlists?portfolioId=${PORTFOLIO_ID}`)
      .then(r => r.json()).then(setWatchlists).catch(console.error);

  const loadActive = (id: string) =>
    fetch(`${API}/watchlists/${id}`)
      .then(r => r.json()).then(setActive).catch(console.error);

  useEffect(() => { loadLists(); }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) { setSearchResults([]); return; }
    fetch(`${API}/assets/search?query=${encodeURIComponent(q)}`)
      .then(r => r.json()).then(setSearchResults).catch(console.error);
  }, [searchQuery]);

  const createWatchlist = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/watchlists?portfolioId=${PORTFOLIO_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const wl = await res.json();
      setNewName("");
      await loadLists();
      loadActive(wl.id);
    } finally { setCreating(false); }
  };

  const deleteWatchlist = async (id: string) => {
    await fetch(`${API}/watchlists/${id}`, { method: "DELETE" });
    if (active?.id === id) setActive(null);
    await loadLists();
  };

  const saveRename = async (id: string) => {
    await fetch(`${API}/watchlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameVal }),
    });
    setRenaming(null);
    await loadLists();
    if (active?.id === id) loadActive(id);
  };

  const addItem = async (symbol: string) => {
    if (!active) return;
    setAddingSymbol(symbol);
    try {
      await fetch(`${API}/watchlists/${active.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      setSearchQuery("");
      setSearchResults([]);
      await loadActive(active.id);
      await loadLists();
    } finally { setAddingSymbol(null); }
  };

  const removeItem = async (symbol: string) => {
    if (!active) return;
    await fetch(`${API}/watchlists/${active.id}/items/${symbol}`, { method: "DELETE" });
    await loadActive(active.id);
    await loadLists();
  };

  const inputStyle: React.CSSProperties = {
    background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
    borderRadius: "10px", padding: "10px 14px", fontSize: "14px", fontFamily: C.font,
  };

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Portfolio</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Holdings</h2>
      <p style={{ color: C.muted, marginBottom: "40px" }}>All current positions across your account.</p>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", marginBottom: "32px" }}>
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
            <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: "26px", marginTop: "14px", marginBottom: 0, color: color ?? C.text }}>{value}</h3>
          </div>
        ))}
      </div>

      {/* Positions table */}
      <section style={sectionStyle}>
        <p style={labelStyle}>Positions</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>
          {sorted.length} {sorted.length === 1 ? "Position" : "Positions"}
        </h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "center" }}>
              <th style={th("symbol", "Symbol")}        onClick={() => toggleSort("symbol")}>Symbol{arrow("symbol")}</th>
              <th style={th(null, "30d")}               >30D</th>
              <th style={th("dayChangePct", "Day")}     onClick={() => toggleSort("dayChangePct")}>Day<br/>Chg{arrow("dayChangePct")}</th>
              <th style={th("quantityHeld", "Qty")}     onClick={() => toggleSort("quantityHeld")}>Qty{arrow("quantityHeld")}</th>
              <th style={th("averageCostBasis", "Avg")} onClick={() => toggleSort("averageCostBasis")}>Avg<br/>Cost{arrow("averageCostBasis")}</th>
              <th style={th("marketValue", "Value")}    onClick={() => toggleSort("marketValue")}>Mkt<br/>Value{arrow("marketValue")}</th>
              <th style={th(null, "Price")}             >Mkt<br/>Price</th>
              <th style={th("unrealizedGain", "Gain")}  onClick={() => toggleSort("unrealizedGain")}>Unreal.<br/>Gain{arrow("unrealizedGain")}</th>
              <th style={th(null, "Return")}            >Return<br/>%</th>
              <th style={th(null, "Held")}              >Held</th>
              <th style={th(null, "Alloc")}             >Alloc<br/>%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0
              ? <tr><td colSpan={11} style={{ padding: "32px 0", color: C.muted, textAlign: "center" }}>No holdings found.</td></tr>
              : sorted.map((h: any) => {
                const returnPct = Number(h.totalCostBasis) > 0
                  ? ((Number(h.marketValue) - Number(h.totalCostBasis)) / Number(h.totalCostBasis) * 100)
                  : 0;
                const dayUp = Number(h.dayChange ?? 0) >= 0;
                const sparkData = Array.isArray(h.sparkline)
                  ? h.sparkline.map((v: number) => ({ v }))
                  : [];
                return (
                  <tr key={h.assetId} style={{ borderTop: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                    onClick={() => navigate(`/research?symbol=${h.symbol}`)}>
                    <td style={tableCellStyle}>
                      <span style={{ color: C.gold, fontWeight: 700, fontSize: "16px" }}>{h.symbol}</span>
                      <span style={{ display: "block", color: C.muted, fontSize: "11px", marginTop: "2px" }}>{h.assetName}</span>
                    </td>
                    <td style={{ ...tableCellStyle, width: "80px", padding: "8px 12px" }}>
                      {sparkData.length > 1
                        ? <ResponsiveContainer width={80} height={36}>
                            <LineChart data={sparkData}>
                              <Line type="monotone" dataKey="v" stroke={dayUp ? C.green : C.red}
                                strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        : <span style={{ color: C.muted, fontSize: "11px" }}>—</span>}
                    </td>
                    <td style={{ ...tableCellStyle, color: dayUp ? C.green : C.red }}>
                      {h.dayChange != null
                        ? <>{dayUp ? "+" : ""}{Number(h.dayChange).toFixed(2)}<br/>
                            <span style={{ fontSize: "11px" }}>
                              {dayUp ? "+" : ""}{Number(h.dayChangePct).toFixed(2)}%
                            </span></>
                        : "—"}
                    </td>
                    <td style={tableCellStyle}>{Number(h.quantityHeld).toFixed(4)}</td>
                    <td style={tableCellStyle}>${Number(h.averageCostBasis).toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                      ${Number(h.marketValue).toLocaleString("en-US",{minimumFractionDigits:2})}
                    </td>
                    <td style={tableCellStyle}>${Number(h.marketPrice).toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, color: Number(h.unrealizedGain) >= 0 ? C.green : C.red }}>
                      ${Number(h.unrealizedGain).toLocaleString("en-US",{minimumFractionDigits:2})}
                    </td>
                    <td style={{ ...tableCellStyle, color: returnPct >= 0 ? C.green : C.red }}>
                      {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                    </td>
                    <td style={{ ...tableCellStyle, color: C.muted, fontSize: "13px" }}>
                      {holdingPeriod(h.firstBuyDate)}
                    </td>
                    <td style={tableCellStyle}>
                      {Number(h.allocationPercent).toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </section>

      {/* ── Watchlists ─────────────────────────────────────── */}
      <div style={{ marginTop: "48px" }}>
        <p style={labelStyle}>Tracking</p>
        <h2 style={{ fontSize: "36px", marginTop: "12px", marginBottom: "4px" }}>Watchlists</h2>
        <p style={{ color: C.muted, marginBottom: "32px" }}>Track assets you're monitoring without holding them.</p>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px", alignItems: "start" }}>

          {/* Left — list of watchlists */}
          <section style={sectionStyle}>
            <p style={labelStyle}>My Lists</p>

            <div style={{ display: "flex", gap: "8px", marginTop: "20px", marginBottom: "24px" }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createWatchlist()}
                placeholder="New list name…"
                style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: "13px" }} />
              <button onClick={createWatchlist} disabled={creating || !newName.trim()} style={{
                background: C.gold, color: "#000", border: "none", borderRadius: "10px",
                padding: "8px 14px", cursor: "pointer", fontFamily: C.font, fontWeight: 700, fontSize: "13px",
                opacity: !newName.trim() ? 0.5 : 1,
              }}>+</button>
            </div>

            {watchlists.length === 0
              ? <p style={{ color: C.muted, fontSize: "13px" }}>No watchlists yet.</p>
              : watchlists.map((wl: any) => (
                <div key={wl.id} style={{
                  padding: "12px 14px", borderRadius: "12px", marginBottom: "6px", cursor: "pointer",
                  background: active?.id === wl.id ? "rgba(200,169,106,0.1)" : "transparent",
                  border: active?.id === wl.id ? `1px solid rgba(200,169,106,0.3)` : `1px solid transparent`,
                }}>
                  {renaming === wl.id
                    ? <div style={{ display: "flex", gap: "6px" }}>
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveRename(wl.id); if (e.key === "Escape") setRenaming(null); }}
                          autoFocus
                          style={{ ...inputStyle, flex: 1, padding: "5px 10px", fontSize: "13px" }} />
                        <button onClick={() => saveRename(wl.id)} style={{ background: C.gold, color: "#000", border: "none", borderRadius: "8px", padding: "5px 10px", cursor: "pointer", fontFamily: C.font, fontSize: "12px", fontWeight: 700 }}>✓</button>
                      </div>
                    : <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                        onClick={() => loadActive(wl.id)}>
                        <div>
                          <p style={{ margin: 0, fontSize: "14px", color: active?.id === wl.id ? C.gold : C.text }}>{wl.name}</p>
                          <p style={{ margin: 0, fontSize: "11px", color: C.muted, marginTop: "2px" }}>{wl.itemCount} {wl.itemCount === 1 ? "asset" : "assets"}</p>
                        </div>
                        <div style={{ display: "flex", gap: "4px" }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setRenaming(wl.id); setRenameVal(wl.name); }} style={{
                            background: "transparent", color: C.muted, border: "none",
                            cursor: "pointer", fontSize: "13px", padding: "4px",
                          }}>✎</button>
                          <button onClick={() => deleteWatchlist(wl.id)} style={{
                            background: "transparent", color: C.muted, border: "none",
                            cursor: "pointer", fontSize: "13px", padding: "4px",
                          }}>✕</button>
                        </div>
                      </div>
                  }
                </div>
              ))
            }
          </section>

          {/* Right — selected watchlist contents */}
          <div>
            {!active
              ? <section style={{ ...sectionStyle, textAlign: "center", padding: "60px" }}>
                  <p style={{ color: C.muted, fontSize: "16px" }}>Select or create a watchlist to get started.</p>
                </section>
              : <section style={sectionStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
                    <div>
                      <p style={labelStyle}>{active.itemCount} {active.itemCount === 1 ? "Asset" : "Assets"}</p>
                      <h3 style={{ fontSize: "28px", margin: "8px 0 0" }}>{active.name}</h3>
                    </div>
                    <div style={{ position: "relative", width: "260px" }}>
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Add asset by symbol…"
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", fontSize: "13px", padding: "9px 14px" }} />
                      {searchResults.length > 0 && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                          background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px",
                          overflow: "hidden",
                        }}>
                          {searchResults.slice(0, 6).map((a: any) => (
                            <button key={a.id} onClick={() => addItem(a.symbol)}
                              disabled={addingSymbol === a.symbol}
                              style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                width: "100%", padding: "10px 14px", background: "transparent", color: C.text,
                                border: 0, borderBottom: `1px solid ${C.borderSubtle}`,
                                cursor: "pointer", fontFamily: C.font, textAlign: "left",
                              }}>
                              <span style={{ color: C.gold, fontWeight: 700, fontSize: "13px" }}>{a.symbol}</span>
                              <span style={{ color: C.muted, fontSize: "12px" }}>{a.name?.slice(0, 22)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {active.items.length === 0
                    ? <p style={{ color: C.muted }}>No assets yet — search above to add one.</p>
                    : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left" }}>
                            <th style={{ paddingBottom: "12px" }}>Symbol</th>
                            <th style={{ paddingBottom: "12px" }}>30D</th>
                            <th style={{ paddingBottom: "12px" }}>Price</th>
                            <th style={{ paddingBottom: "12px" }}>Day Change</th>
                            <th style={{ paddingBottom: "12px" }}>Exchange</th>
                            <th style={{ paddingBottom: "12px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {active.items.map((item: any) => {
                            const up = Number(item.dayChange ?? 0) >= 0;
                            const sparkData = Array.isArray(item.sparkline)
                              ? item.sparkline.map((v: number) => ({ v }))
                              : [];
                            return (
                              <tr key={item.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                                <td style={tableCellStyle}>
                                  <span style={{ color: C.gold, fontWeight: 700, fontSize: "15px", cursor: "pointer" }}
                                    onClick={() => navigate(`/research?symbol=${item.symbol}`)}>
                                    {item.symbol}
                                  </span>
                                  <span style={{ display: "block", color: C.muted, fontSize: "11px", marginTop: "2px" }}>{item.name}</span>
                                </td>
                                <td style={{ ...tableCellStyle, width: "80px" }}>
                                  {sparkData.length > 1
                                    ? <ResponsiveContainer width={80} height={36}>
                                        <LineChart data={sparkData}>
                                          <Line type="monotone" dataKey="v"
                                            stroke={up ? C.green : C.red} strokeWidth={1.5} dot={false} />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    : <span style={{ color: C.muted, fontSize: "11px" }}>—</span>}
                                </td>
                                <td style={tableCellStyle}>
                                  {item.price != null ? `$${Number(item.price).toFixed(2)}` : "—"}
                                </td>
                                <td style={{ ...tableCellStyle, color: up ? C.green : C.red }}>
                                  {item.dayChange != null
                                    ? <>{up ? "+" : ""}{Number(item.dayChange).toFixed(2)}{" "}
                                        <span style={{ fontSize: "11px" }}>
                                          ({up ? "+" : ""}{Number(item.dayChangePct).toFixed(2)}%)
                                        </span></>
                                    : "—"}
                                </td>
                                <td style={{ ...tableCellStyle, color: C.muted, fontSize: "13px" }}>{item.exchange ?? "—"}</td>
                                <td style={{ ...tableCellStyle, textAlign: "right" }}>
                                  <button onClick={() => removeItem(item.symbol)} style={{
                                    background: "transparent", color: C.muted, border: `1px solid ${C.borderSubtle}`,
                                    borderRadius: "8px", padding: "4px 12px", cursor: "pointer",
                                    fontFamily: C.font, fontSize: "12px",
                                  }}>Remove</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                  }
                </section>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
