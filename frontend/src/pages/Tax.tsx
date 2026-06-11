import { useEffect, useState } from "react";
import { API, ACCOUNT_ID, PORTFOLIO_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

// ── helpers ────────────────────────────────────────────────────────────────

function isLongTerm(acquisitionDate: string, endDate?: string): boolean {
  const end   = endDate ? new Date(endDate) : new Date();
  const start = new Date(acquisitionDate);
  return (end.getTime() - start.getTime()) > 365 * 24 * 60 * 60 * 1000;
}

function daysHeld(acquisitionDate: string, endDate?: string): number {
  const end = endDate ? new Date(endDate) : new Date();
  return Math.floor((end.getTime() - new Date(acquisitionDate).getTime()) / (1000 * 60 * 60 * 24));
}

function fmt$(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-$" : "$") + abs;
}

type SortDir = "asc" | "desc";

function useSortable<T>(data: T[], defaultKey: keyof T | null = null, defaultDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(key: keyof T) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
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

function SortTh({ label, sortKey, activeSortKey, sortDir, onSort, style }: {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: SortDir;
  onSort: (k: string) => void;
  style?: React.CSSProperties;
}) {
  const active = activeSortKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        color: active ? C.gold : C.muted,
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        textAlign: "left",
        paddingBottom: "12px",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
      <span style={{ marginLeft: "4px", opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}

// ── component ──────────────────────────────────────────────────────────────

export default function Tax() {
  const [allLots, setAllLots]         = useState<any[]>([]);
  const [allAllocs, setAllAllocs]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterSymbol, setFilterSymbol] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL"|"OPEN"|"CLOSED">("ALL");
  const [filterAllocSymbol, setFilterAllocSymbol] = useState("ALL");
  const [taxYear, setTaxYear]           = useState<string>("ALL");
  const [taxStrategy, setTaxStrategy]   = useState<string>("FIFO");
  const [strategyMsg, setStrategyMsg]   = useState<string | null>(null);
  const [stRate, setStRate] = useState(32);
  const [ltRate, setLtRate] = useState(15);
  const [rebuilding, setRebuilding] = useState(false);
  const [needsRebuild, setNeedsRebuild] = useState(false);

  useEffect(() => {
    fetch(`${API}/holdings/account/${ACCOUNT_ID}`)
      .then(r => r.json())
      .then(async (h: any[]) => {
        const symbols = h.map((x: any) => x.symbol);
        const lots   = await Promise.all(symbols.map((s: string) => fetch(`${API}/tax-lots/assets/${s}`).then(r => r.json())));
        const allocs = await Promise.all(symbols.map((s: string) => fetch(`${API}/tax-lots/assets/${s}/allocations`).then(r => r.json())));
        setAllLots(lots.flat());
        setAllAllocs(allocs.flat());
        setLoading(false);
      })
      .catch(e => { console.error(e); setLoading(false); });

    fetch(`${API}/portfolios/${PORTFOLIO_ID}`)
      .then(r => r.json())
      .then(d => setTaxStrategy(d.taxStrategy ?? "FIFO"))
      .catch(console.error);
  }, []);

  const updateTaxStrategy = async (strategy: string) => {
    if (strategy === taxStrategy) return;
    const previous = taxStrategy;
    setTaxStrategy(strategy);
    setStrategyMsg(null);
    setNeedsRebuild(false);
    try {
      const res = await fetch(`${API}/portfolios/${PORTFOLIO_ID}/tax-strategy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxStrategy: strategy }),
      });
      if (!res.ok) throw new Error();
      setNeedsRebuild(true);
    } catch {
      setTaxStrategy(previous);
      setStrategyMsg("Failed to update tax strategy.");
    }
  };

  const rebuildAllocations = async () => {
    setRebuilding(true);
    setStrategyMsg(null);
    try {
      const res = await fetch(`${API}/tax-lots/rebuild/${PORTFOLIO_ID}`, { method: "POST" });
      if (!res.ok) throw new Error();
      // Reload lots and allocations
      const h: any[] = await fetch(`${API}/holdings/account/${ACCOUNT_ID}`).then(r => r.json());
      const symbols = h.map((x: any) => x.symbol);
      const [lots, allocs] = await Promise.all([
        Promise.all(symbols.map((s: string) => fetch(`${API}/tax-lots/assets/${s}`).then(r => r.json()))),
        Promise.all(symbols.map((s: string) => fetch(`${API}/tax-lots/assets/${s}/allocations`).then(r => r.json()))),
      ]);
      setAllLots(lots.flat());
      setAllAllocs(allocs.flat());
      setNeedsRebuild(false);
      setStrategyMsg(`Rebuilt with ${taxStrategy}.`);
    } catch {
      setStrategyMsg("Rebuild failed — check server logs.");
    } finally {
      setRebuilding(false);
    }
  };

  // ── derived data ───────────────────────────────────────────────────────

  // O(1) lot lookup — built once, used everywhere
  const lotById: Record<string, any> = Object.fromEntries(allLots.map((l: any) => [l.id, l]));

  const taxYears = ["ALL", ...Array.from(
    new Set(allAllocs.map((a: any) => (a.sellDate ?? a.createdAt ?? "").slice(0, 4)))
  ).filter(Boolean).sort().reverse()];

  const filteredAllocs = allAllocs.filter((a: any) => {
    if (taxYear !== "ALL" && !(a.sellDate ?? a.createdAt ?? "").startsWith(taxYear)) return false;
    if (filterAllocSymbol !== "ALL") {
      const sym = lotById[a.taxLotId]?.symbol ?? "";
      if (sym !== filterAllocSymbol) return false;
    }
    return true;
  });

  const totalRealized = filteredAllocs.reduce((s: number, a: any) => s + Number(a.realizedGain ?? 0), 0);
  const ltGain = filteredAllocs.reduce((s: number, a: any) => {
    const lot = lotById[a.taxLotId];
    return isLongTerm(lot?.acquisitionDate ?? "", a.sellDate) ? s + Number(a.realizedGain ?? 0) : s;
  }, 0);
  const stGain = totalRealized - ltGain;
  const estTax = Math.max(0, (stGain * stRate / 100) + (ltGain > 0 ? ltGain * ltRate / 100 : 0));

  const symbols = ["ALL", ...Array.from(new Set(allLots.map((l: any) => l.symbol)))];
  const filteredLots = allLots.filter((l: any) => {
    if (filterSymbol !== "ALL" && l.symbol !== filterSymbol) return false;
    if (filterStatus === "OPEN"   && l.closed)  return false;
    if (filterStatus === "CLOSED" && !l.closed) return false;
    return true;
  });

  const approachingLT = allLots.filter((l: any) => {
    if (l.closed || Number(l.quantityRemaining) <= 0) return false;
    const days = daysHeld(l.acquisitionDate);
    return days >= 306 && days <= 365;
  });

  // Enrich lots/allocs with sortable computed fields
  const enrichedLots = filteredLots.map((l: any) => ({
    ...l,
    _days: daysHeld(l.acquisitionDate, l.closed ? l.closedDate : undefined),
    _lt:   isLongTerm(l.acquisitionDate, l.closed ? l.closedDate : undefined),
    _quantityPurchased: Number(l.quantityPurchased),
    _quantityRemaining: Number(l.quantityRemaining),
    _costBasisPerUnit:  Number(l.costBasisPerUnit),
    _totalCostBasis:    Number(l.quantityRemaining) * Number(l.costBasisPerUnit),
  }));

  const enrichedAllocs = filteredAllocs.map((a: any) => {
    const lot = lotById[a.taxLotId];
    return {
      ...a,
      _symbol:    lot?.symbol ?? "",
      _sellDate:  a.sellDate ?? a.createdAt ?? "",
      _lt:        isLongTerm(lot?.acquisitionDate ?? "", a.sellDate),
      _proceeds:  Number(a.proceeds),
      _costBasis: Number(a.costBasis),
      _gain:      Number(a.realizedGain),
      _qty:       Number(a.quantityAllocated),
    };
  });

  const lotsSort   = useSortable(enrichedLots,   "acquisitionDate");
  const allocsSort = useSortable(enrichedAllocs, "_sellDate", "desc");

  // ── styles ─────────────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    background: C.bg, color: C.text,
    border: `1px solid rgba(200,169,106,0.35)`,
    borderRadius: "8px", padding: "8px 14px",
    fontFamily: C.font, fontSize: "14px", cursor: "pointer",
  };

  const th: React.CSSProperties = {
    color: C.muted, fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em", textAlign: "left" as const,
    paddingBottom: "12px",
  };

  const rateInput: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${C.border}`, borderRadius: "6px",
    color: C.text, fontFamily: C.font, fontSize: "14px",
    padding: "4px 8px", width: "52px",
    textAlign: "center" as const, outline: "none",
  };

  if (loading) return <p style={{ color: C.gold, fontFamily: C.font }}>Loading tax data…</p>;

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Tax Intelligence</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Tax Center</h2>
      <p style={{ color: C.muted, marginBottom: "24px" }}>
        Realized gains, tax lots, and cost basis allocation across all positions.
      </p>

      {/* Cost basis method */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
        <span style={{ color: C.muted, fontSize: "13px" }}>Cost Basis Method</span>
        {["FIFO", "LIFO"].map(s => (
          <button key={s} onClick={() => updateTaxStrategy(s)} style={{
            padding: "6px 14px", borderRadius: "999px", cursor: "pointer",
            fontFamily: C.font, fontSize: "12px",
            background: taxStrategy === s ? "rgba(200,169,106,0.15)" : "transparent",
            color: taxStrategy === s ? C.gold : C.muted,
            border: taxStrategy === s ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}`,
          }}>{s}</button>
        ))}
        {needsRebuild && (
          <button
            onClick={rebuildAllocations}
            disabled={rebuilding}
            style={{
              padding: "6px 16px", borderRadius: "999px", cursor: rebuilding ? "default" : "pointer",
              fontFamily: C.font, fontSize: "12px",
              background: "rgba(200,169,106,0.2)",
              color: C.gold,
              border: `1px solid ${C.gold}`,
              opacity: rebuilding ? 0.6 : 1,
            }}
          >
            {rebuilding ? "Rebuilding…" : "Rebuild Now"}
          </button>
        )}
        {strategyMsg && <span style={{ color: C.gold, fontSize: "12px" }}>{strategyMsg}</span>}
      </div>

      {/* Tax year filter */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <span style={{ color: C.muted, fontSize: "13px" }}>Tax Year</span>
        <select value={taxYear} onChange={e => setTaxYear(e.target.value)} style={selectStyle}>
          {taxYears.map(y => <option key={y} value={y}>{y === "ALL" ? "All Years" : y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", marginBottom: "32px" }}>
        {[
          { label: "Total Realized Gain", value: totalRealized },
          { label: "Short-Term Gain",     value: stGain },
          { label: "Long-Term Gain",      value: ltGain },
          { label: "Est. Tax Liability",  value: estTax, isEstimate: true },
        ].map(({ label, value, isEstimate }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
            <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: "24px", marginTop: "14px", marginBottom: 0, color: value >= 0 ? (isEstimate ? C.gold : C.green) : C.red }}>
              {fmt$(value)}
            </h3>
            <p style={{ color: C.muted, fontSize: "12px", marginTop: "6px" }}>
              {isEstimate
                ? totalRealized < 0 ? "Net loss — up to $3k deductible" : `ST ${stRate}% / LT ${ltRate}%`
                : value < 0 ? "Net loss" : "Net gain"}
            </p>
          </div>
        ))}
      </div>

      {/* Tax rate editor */}
      <div style={{ ...sectionStyle, marginBottom: "28px", display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
        <span style={{ color: C.muted, fontSize: "13px" }}>Tax Rates (edit to match your bracket)</span>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: C.muted }}>
          Short-term
          <input type="number" min={0} max={60} value={stRate} onChange={e => setStRate(Number(e.target.value))} style={rateInput} />%
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: C.muted }}>
          Long-term
          <input type="number" min={0} max={40} value={ltRate} onChange={e => setLtRate(Number(e.target.value))} style={rateInput} />%
        </label>
        <span style={{ color: C.muted, fontSize: "12px" }}>
          Common: ST 22–37% (ordinary income) · LT 0%, 15%, or 20% depending on income
        </span>
      </div>

      {/* Approaching long-term threshold */}
      {approachingLT.length > 0 && (
        <div style={{ ...sectionStyle, marginBottom: "28px", borderColor: "rgba(200,169,106,0.4)" }}>
          <p style={{ ...labelStyle, margin: "0 0 8px" }}>⏳ Approaching Long-Term Threshold</p>
          <p style={{ color: C.muted, fontSize: "13px", margin: "0 0 20px" }}>
            These open lots turn long-term within 60 days — consider waiting before selling to cut your tax rate.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Symbol", "Acquired", "Days Held", "Days Until LT", "Qty Remaining", "Cost Basis"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {approachingLT.map((lot: any) => {
                const days = daysHeld(lot.acquisitionDate);
                return (
                  <tr key={lot.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                    <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 700 }}>{lot.symbol}</td>
                    <td style={tableCellStyle}>{lot.acquisitionDate}</td>
                    <td style={tableCellStyle}>{days}d</td>
                    <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 600 }}>{365 - days}d</td>
                    <td style={tableCellStyle}>{Number(lot.quantityRemaining).toFixed(4)}</td>
                    <td style={tableCellStyle}>{fmt$(Number(lot.quantityRemaining) * Number(lot.costBasisPerUnit))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tax Lots */}
      <section style={{ ...sectionStyle, marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <p style={labelStyle}>Tax Lots</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>All Lots — {lotsSort.sorted.length} shown</h3>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <select value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} style={selectStyle}>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={selectStyle}>
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {(["symbol","acquisitionDate","_quantityPurchased","_quantityRemaining","_costBasisPerUnit","_totalCostBasis","_days","closed"] as const).map((key, i) => (
                <SortTh
                  key={key}
                  label={["Symbol","Acquired","Purchased","Remaining","Cost/Share","Lot Cost","Holding Period","Status"][i]}
                  sortKey={key}
                  activeSortKey={lotsSort.sortKey as string}
                  sortDir={lotsSort.sortDir}
                  onSort={k => lotsSort.toggle(k as any)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {lotsSort.sorted.length === 0
              ? <tr><td colSpan={8} style={{ padding: "24px 0", color: C.muted, textAlign: "center" }}>No lots match this filter.</td></tr>
              : lotsSort.sorted.map((lot: any) => (
                <tr key={lot.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                  <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 700 }}>{lot.symbol}</td>
                  <td style={tableCellStyle}>{lot.acquisitionDate}</td>
                  <td style={tableCellStyle}>{lot._quantityPurchased.toFixed(4)}</td>
                  <td style={tableCellStyle}>{lot._quantityRemaining.toFixed(4)}</td>
                  <td style={tableCellStyle}>${lot._costBasisPerUnit.toFixed(2)}</td>
                  <td style={tableCellStyle}>${lot._totalCostBasis.toFixed(2)}</td>
                  <td style={{ ...tableCellStyle, color: lot._lt ? C.green : C.gold, fontSize: "12px" }}>
                    {lot._days}d — {lot._lt ? "Long-term" : "Short-term"}
                    {lot.closed && lot.closedDate && <span style={{ color: C.muted }}> (at sale)</span>}
                  </td>
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

      {/* Realized Gains Audit */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <p style={labelStyle}>Realized Gain Audit</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>
              {taxStrategy} Allocations — {allocsSort.sorted.length} records{taxYear !== "ALL" ? ` (${taxYear})` : ""}
            </h3>
          </div>
          <select value={filterAllocSymbol} onChange={e => setFilterAllocSymbol(e.target.value)} style={selectStyle}>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {(["_sellDate","_symbol","_qty","_proceeds","_costBasis","_gain","_lt"] as const).map((key, i) => (
                <SortTh
                  key={key}
                  label={["Sell Date","Symbol","Qty Allocated","Proceeds","Cost Basis","Realized Gain","Type"][i]}
                  sortKey={key}
                  activeSortKey={allocsSort.sortKey as string}
                  sortDir={allocsSort.sortDir}
                  onSort={k => allocsSort.toggle(k as any)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {allocsSort.sorted.length === 0
              ? <tr><td colSpan={7} style={{ padding: "24px 0", color: C.muted, textAlign: "center" }}>No realized gains for this period.</td></tr>
              : allocsSort.sorted.map((a: any) => (
                <tr key={a.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                  <td style={tableCellStyle}>
                    {a.sellDate ? new Date(a.sellDate).toLocaleDateString() : new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 700 }}>{a._symbol || "—"}</td>
                  <td style={tableCellStyle}>{a._qty.toFixed(4)}</td>
                  <td style={tableCellStyle}>{fmt$(a._proceeds)}</td>
                  <td style={tableCellStyle}>{fmt$(a._costBasis)}</td>
                  <td style={{ ...tableCellStyle, color: a._gain >= 0 ? C.green : C.red }}>{fmt$(a._gain)}</td>
                  <td style={{ ...tableCellStyle, fontSize: "12px", color: a._lt ? C.green : C.gold }}>
                    {a._lt ? "Long-term" : "Short-term"}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </section>
    </div>
  );
}
