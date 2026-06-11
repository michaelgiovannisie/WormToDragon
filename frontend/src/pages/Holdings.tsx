import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { API, PORTFOLIO_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";
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
  label: React.ReactNode;
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
        letterSpacing: "0.06em", textAlign: "center" as const,
        paddingBottom: "12px", cursor: "pointer",
        userSelect: "none" as const, whiteSpace: "normal" as const,
        lineHeight: "1.3", verticalAlign: "bottom",
      }}
    >
      {label}
      <span style={{ marginLeft: "4px", opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}

function NoSortTh({ label }: { label: React.ReactNode }) {
  return (
    <th style={{
      color: C.muted, fontSize: "12px", textTransform: "uppercase" as const,
      letterSpacing: "0.06em", paddingBottom: "12px", textAlign: "center" as const,
      whiteSpace: "normal" as const, lineHeight: "1.3", verticalAlign: "bottom",
    }}>
      {label}
    </th>
  );
}

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

// ── component ──────────────────────────────────────────────────────────────

export default function Holdings() {
  const navigate = useNavigate();

  // ── Holdings ──────────────────────────────────────────────
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const loadData = async () => {
    setError(null);
    try {
      const [h, s] = await Promise.all([
        fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}/summary`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      ]);
      setHoldings(h);
      setSummary(s);
    } catch {
      setError("Failed to load holdings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Enrich each row with pre-computed numeric fields for sorting
  const enrichedHoldings = holdings.map((h: any) => {
    const marketValue = Number(h.marketValue ?? 0);
    const costBasis   = Number(h.totalCostBasis ?? 0);
    const returnPct   = costBasis > 0 ? (marketValue - costBasis) / costBasis * 100 : 0;
    const sparkArr    = Array.isArray(h.sparkline) ? h.sparkline as number[] : [];
    // Use spark's own first→last trend for color (not today's dayChange)
    const sparkTrend  = sparkArr.length > 1 ? sparkArr[sparkArr.length - 1] - sparkArr[0] : Number(h.dayChange ?? 0);
    return {
      ...h,
      _marketValue:    marketValue,
      _unrealGain:     Number(h.unrealizedGain ?? 0),
      _returnPct:      returnPct,
      _dayChangePct:   Number(h.dayChangePct ?? 0),
      _quantityHeld:   Number(h.quantityHeld ?? 0),
      _avgCost:        Number(h.averageCostBasis ?? 0),
      _costBasis:      costBasis,
      _allocationPct:  Number(h.allocationPercent ?? 0),
      _firstBuyDate:   h.firstBuyDate ?? null,
      _sparkTrend:     sparkTrend,
    };
  });

  const { sorted, sortKey, sortDir, toggle } = useSortable(
    enrichedHoldings,
    "_marketValue",
    "desc",
    ["_marketValue", "_unrealGain", "_returnPct", "_dayChangePct", "_quantityHeld", "_costBasis", "_allocationPct"],
  );

  const thP = (key: string) => ({
    sortKey: key,
    activeSortKey: sortKey as string | null,
    sortDir,
    onSort: toggle as (k: string) => void,
  });

  const totalReturn = Number(summary?.totalCostBasis ?? 0) > 0
    ? ((Number(summary?.totalMarketValue) - Number(summary?.totalCostBasis)) / Number(summary?.totalCostBasis) * 100).toFixed(2)
    : "0.00";

  const summaryCards = [
    { label: "Total Cost Basis",   value: fmt$(Number(summary?.totalCostBasis ?? 0)) },
    { label: "Total Market Value", value: fmt$(Number(summary?.totalMarketValue ?? 0)) },
    { label: "Unrealized Gain",    value: fmt$(Number(summary?.totalUnrealizedGain ?? 0)), color: Number(summary?.totalUnrealizedGain ?? 0) >= 0 ? C.green : C.red },
    { label: "Total Return",       value: `${Number(totalReturn) >= 0 ? "+" : ""}${totalReturn}%`, color: Number(totalReturn) >= 0 ? C.green : C.red },
  ];

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
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const deleteWatchlist = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`${API}/watchlists/${id}`, { method: "DELETE" });
    if (active?.id === id) setActive(null);
    await loadLists();
  };

  const saveRename = async (id: string) => {
    if (!renameVal.trim()) { setRenaming(null); return; }
    await fetch(`${API}/watchlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameVal.trim() }),
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

  if (loading) return <p style={{ color: C.muted, fontFamily: C.font, padding: "40px" }}>Loading…</p>;

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Portfolio</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Holdings</h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "40px", flexWrap: "wrap", gap: "12px" }}>
        <p style={{ color: C.muted, margin: 0 }}>All current positions across your account.</p>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <HoldingsSyncWidget onComplete={loadData} />
          <Nasdaq100SyncWidget />
        </div>
      </div>

      {error && <p style={{ color: C.red, marginBottom: "24px" }}>{error}</p>}

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
            <tr>
              <SortTh label="Symbol"              {...thP("symbol")}          />
              <NoSortTh label="30D"               />
              <SortTh label={<>Day<br/>Chg</>}    {...thP("_dayChangePct")}   />
              <SortTh label="Qty"                 {...thP("_quantityHeld")}   />
              <SortTh label={<>Avg<br/>Cost</>}   {...thP("_avgCost")}        />
              <SortTh label={<>Mkt<br/>Value</>}  {...thP("_marketValue")}    />
              <NoSortTh label={<>Mkt<br/>Price</>} />
              <SortTh label={<>Unreal.<br/>Gain</>} {...thP("_unrealGain")}   />
              <SortTh label={<>Return<br/>%</>}   {...thP("_returnPct")}      />
              <SortTh label="Held"                {...thP("_firstBuyDate")}   />
              <SortTh label={<>Alloc<br/>%</>}    {...thP("_allocationPct")}  />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0
              ? <tr><td colSpan={11} style={{ padding: "32px 0", color: C.muted, textAlign: "center" }}>No holdings found.</td></tr>
              : sorted.map((h: any) => {
                const dayUp    = Number(h.dayChange ?? 0) >= 0;
                const sparkUp  = h._sparkTrend >= 0;
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
                              <Line type="monotone" dataKey="v" stroke={sparkUp ? C.green : C.red}
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
                    <td style={tableCellStyle}>{h._quantityHeld.toFixed(4)}</td>
                    <td style={tableCellStyle}>${h._avgCost.toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>{fmt$(h._marketValue)}</td>
                    <td style={tableCellStyle}>${Number(h.marketPrice).toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, color: h._unrealGain >= 0 ? C.green : C.red }}>
                      {fmt$(h._unrealGain)}
                    </td>
                    <td style={{ ...tableCellStyle, color: h._returnPct >= 0 ? C.green : C.red }}>
                      {h._returnPct >= 0 ? "+" : ""}{h._returnPct.toFixed(2)}%
                    </td>
                    <td style={{ ...tableCellStyle, color: C.muted, fontSize: "13px" }}>
                      {holdingPeriod(h._firstBuyDate)}
                    </td>
                    <td style={tableCellStyle}>
                      {h._allocationPct.toFixed(1)}%
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
                          <button onClick={() => deleteWatchlist(wl.id, wl.name)} style={{
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
                    <div ref={searchRef} style={{ position: "relative", width: "260px" }}>
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
                            // Watchlist spark: color by 30d trend, not today's move
                            const sparkUp = sparkData.length > 1
                              ? sparkData[sparkData.length - 1].v >= sparkData[0].v
                              : up;
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
                                            stroke={sparkUp ? C.green : C.red} strokeWidth={1.5} dot={false} />
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
