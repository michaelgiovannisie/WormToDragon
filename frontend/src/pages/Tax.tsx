import { useEffect, useState } from "react";
import { API, ACCOUNT_ID, PORTFOLIO_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

export default function Tax() {
  const [, setHoldings]               = useState<any[]>([]);
  const [allLots, setAllLots]         = useState<any[]>([]);
  const [allAllocs, setAllAllocs]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterSymbol, setFilterSymbol] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL"|"OPEN"|"CLOSED">("ALL");
  const [taxStrategy, setTaxStrategy]   = useState<string>("FIFO");
  const [strategyMsg, setStrategyMsg]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/holdings/account/${ACCOUNT_ID}`)
      .then(r => r.json())
      .then(async (h: any[]) => {
        setHoldings(h);
        const symbols = h.map((x: any) => x.symbol);
        const lots = await Promise.all(
          symbols.map(s => fetch(`${API}/tax-lots/assets/${s}`).then(r => r.json()))
        );
        const allocs = await Promise.all(
          symbols.map(s => fetch(`${API}/tax-lots/assets/${s}/allocations`).then(r => r.json()))
        );
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
    const previous = taxStrategy;
    setTaxStrategy(strategy);
    setStrategyMsg(null);
    try {
      const res = await fetch(`${API}/portfolios/${PORTFOLIO_ID}/tax-strategy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxStrategy: strategy }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setStrategyMsg(`Tax method set to ${strategy}. Rebuild positions to apply.`);
    } catch {
      setTaxStrategy(previous);
      setStrategyMsg("Failed to update tax strategy.");
    }
  };

  const totalRealized  = allAllocs.reduce((sum, a) => sum + Number(a.realizedGain ?? 0), 0);
  const now            = new Date();
  const isLongTerm     = (acquisitionDate: string, sellDate?: string) => {
    const end   = sellDate ? new Date(sellDate) : now;
    const start = new Date(acquisitionDate);
    return (end.getTime() - start.getTime()) >= 365 * 24 * 60 * 60 * 1000;
  };

  const ltGain = allAllocs.reduce((sum, a) => {
    const lot = allLots.find((l: any) => l.id === a.taxLotId);
    return isLongTerm(lot?.acquisitionDate ?? "", a.createdAt)
      ? sum + Number(a.realizedGain ?? 0) : sum;
  }, 0);
  const stGain = totalRealized - ltGain;

  const filteredLots = allLots.filter(l => {
    if (filterSymbol !== "ALL" && l.symbol !== filterSymbol) return false;
    if (filterStatus === "OPEN"   && l.closed)  return false;
    if (filterStatus === "CLOSED" && !l.closed) return false;
    return true;
  });

  const symbols = ["ALL", ...Array.from(new Set(allLots.map((l: any) => l.symbol)))];

  const selectStyle: React.CSSProperties = {
    background: C.bg,
    color: C.text,
    border: `1px solid rgba(200,169,106,0.35)`,
    borderRadius: "8px",
    padding: "8px 14px",
    fontFamily: C.font,
    fontSize: "14px",
    cursor: "pointer",
  };

  if (loading) return <p style={{ color: C.gold, fontFamily: C.font }}>Loading tax data…</p>;

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Tax Intelligence</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Tax Center</h2>
      <p style={{ color: C.muted, marginBottom: "24px" }}>
        Realized gains, tax lots, and FIFO allocation audit across all positions.
      </p>

      {/* Tax method selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
        <span style={{ color: C.muted, fontSize: "13px" }}>Cost Basis Method</span>
        {["FIFO", "LIFO", "SPECIFIC_LOT"].map(s => (
          <button key={s} onClick={() => updateTaxStrategy(s)} style={{
            padding: "6px 14px", borderRadius: "999px", cursor: "pointer",
            fontFamily: C.font, fontSize: "12px",
            background: taxStrategy === s ? "rgba(200,169,106,0.15)" : "transparent",
            color: taxStrategy === s ? C.gold : C.muted,
            border: taxStrategy === s ? `1px solid ${C.gold}` : `1px solid ${C.borderSubtle}`,
          }}>{s}</button>
        ))}
        {strategyMsg && <span style={{ color: C.gold, fontSize: "12px" }}>{strategyMsg}</span>}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px", marginBottom: "32px" }}>
        {[
          { label: "Total Realized Gain",  value: totalRealized, prefix: "$" },
          { label: "Short-Term Gain",      value: stGain,        prefix: "$" },
          { label: "Long-Term Gain",       value: ltGain,        prefix: "$" },
        ].map(({ label, value, prefix }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
            <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: "28px", marginTop: "14px", marginBottom: 0, color: value >= 0 ? C.green : C.red }}>
              {prefix}{Math.abs(value).toLocaleString("en-US",{minimumFractionDigits:2})}
            </h3>
            <p style={{ color: C.muted, fontSize: "12px", marginTop: "6px" }}>
              {value < 0 ? "Net loss" : "Net gain"}
            </p>
          </div>
        ))}
      </div>

      {/* Tax Lots */}
      <section style={{ ...sectionStyle, marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <p style={labelStyle}>Tax Lots</p>
            <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>All Lots — {filteredLots.length} shown</h3>
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
            <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
              {["Symbol","Acquired","Purchased","Remaining","Cost/Share","Lot Cost","Holding Period","Status"].map(h => (
                <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLots.length === 0
              ? <tr><td colSpan={8} style={{ padding: "24px 0", color: C.muted, textAlign: "center" }}>No lots match this filter.</td></tr>
              : filteredLots.map((lot: any) => {
                const days = Math.floor((now.getTime() - new Date(lot.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24));
                const lt   = days >= 365;
                return (
                  <tr key={lot.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                    <td style={{ ...tableCellStyle, color: C.gold, fontWeight: 700 }}>{lot.symbol}</td>
                    <td style={tableCellStyle}>{lot.acquisitionDate}</td>
                    <td style={tableCellStyle}>{Number(lot.quantityPurchased).toFixed(4)}</td>
                    <td style={tableCellStyle}>{Number(lot.quantityRemaining).toFixed(4)}</td>
                    <td style={tableCellStyle}>${Number(lot.costBasisPerUnit).toFixed(2)}</td>
                    <td style={tableCellStyle}>${Number(lot.totalCostBasis).toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, color: lt ? C.green : C.gold, fontSize: "12px" }}>
                      {days}d — {lt ? "Long-term" : "Short-term"}
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px",
                        background: lot.closed ? "rgba(224,108,117,0.12)" : "rgba(143,214,148,0.12)",
                        color: lot.closed ? C.red : C.green }}>
                        {lot.closed ? "CLOSED" : "OPEN"}
                      </span>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </section>

      {/* Realized Gains */}
      <section style={sectionStyle}>
        <p style={labelStyle}>Realized Gain Audit</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>FIFO Allocations — {allAllocs.length} records</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>
              {["Date","Qty Allocated","Proceeds","Cost Basis","Realized Gain","Type"].map(h => (
                <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allAllocs.length === 0
              ? <tr><td colSpan={6} style={{ padding: "24px 0", color: C.muted, textAlign: "center" }}>No realized gains yet.</td></tr>
              : allAllocs.map((a: any) => {
                const lot = allLots.find((l: any) => l.id === a.taxLotId);
                const lt  = isLongTerm(lot?.acquisitionDate ?? "", a.createdAt);
                return (
                  <tr key={a.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                    <td style={tableCellStyle}>{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td style={tableCellStyle}>{Number(a.quantityAllocated).toFixed(4)}</td>
                    <td style={tableCellStyle}>${Number(a.proceeds).toFixed(2)}</td>
                    <td style={tableCellStyle}>${Number(a.costBasis).toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, color: Number(a.realizedGain) >= 0 ? C.green : C.red }}>
                      ${Number(a.realizedGain).toFixed(2)}
                    </td>
                    <td style={{ ...tableCellStyle, fontSize: "12px", color: lt ? C.green : C.gold }}>
                      {lt ? "Long-term" : "Short-term"}
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </section>
    </div>
  );
}
