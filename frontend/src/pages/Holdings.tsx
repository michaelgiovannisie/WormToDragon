import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, PORTFOLIO_ID, ACCOUNT_ID } from "../constants";
import { C, sectionStyle, labelStyle, tableCellStyle } from "../theme";

type SortKey = "symbol" | "marketValue" | "unrealizedGain" | "quantityHeld" | "averageCostBasis";

export default function Holdings() {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>(null);
  const [sortKey, setSortKey]   = useState<SortKey>("marketValue");
  const [sortAsc, setSortAsc]   = useState(false);

  useEffect(() => {
    fetch(`${API}/holdings/account/${ACCOUNT_ID}`)
      .then(r => r.json()).then(setHoldings).catch(console.error);
    fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}/summary`)
      .then(r => r.json()).then(setSummary).catch(console.error);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...holdings].sort((a, b) => {
    const av = typeof a[sortKey] === "string" ? a[sortKey] : Number(a[sortKey]);
    const bv = typeof b[sortKey] === "string" ? b[sortKey] : Number(b[sortKey]);
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
    { label: "Total Return",       value: `${totalReturn}%`, color: Number(totalReturn) >= 0 ? C.green : C.red },
  ];

  const colStyle = (key: SortKey): React.CSSProperties => ({
    paddingBottom: "12px",
    cursor: "pointer",
    color: sortKey === key ? C.gold : C.muted,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    userSelect: "none",
    whiteSpace: "nowrap",
  });

  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

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

      {/* Holdings table */}
      <section style={sectionStyle}>
        <p style={labelStyle}>Positions</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>
          {sorted.length} {sorted.length === 1 ? "Position" : "Positions"}
        </h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={colStyle("symbol")}       onClick={() => toggleSort("symbol")}>Symbol{arrow("symbol")}</th>
              <th style={colStyle("quantityHeld")} onClick={() => toggleSort("quantityHeld")}>Quantity{arrow("quantityHeld")}</th>
              <th style={{ ...colStyle("averageCostBasis"), }} onClick={() => toggleSort("averageCostBasis")}>Avg Cost{arrow("averageCostBasis")}</th>
              <th style={colStyle("marketValue")}  onClick={() => toggleSort("marketValue")}>Market Value{arrow("marketValue")}</th>
              <th style={{ paddingBottom: "12px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>Mkt Price</th>
              <th style={colStyle("unrealizedGain")} onClick={() => toggleSort("unrealizedGain")}>Unreal. Gain{arrow("unrealizedGain")}</th>
              <th style={{ paddingBottom: "12px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>Return %</th>
              <th style={{ paddingBottom: "12px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0
              ? <tr><td colSpan={8} style={{ padding: "32px 0", color: C.muted, textAlign: "center" }}>No holdings found.</td></tr>
              : sorted.map((h: any) => {
                const returnPct = Number(h.totalCostBasis) > 0
                  ? ((Number(h.marketValue) - Number(h.totalCostBasis)) / Number(h.totalCostBasis) * 100)
                  : 0;
                return (
                  <tr key={h.id} style={{ borderTop: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                    onClick={() => navigate(`/research?symbol=${h.symbol}`)}>
                    <td style={tableCellStyle}>
                      <span style={{ color: C.gold, fontWeight: 700, fontSize: "16px" }}>{h.symbol}</span>
                      <span style={{ display: "block", color: C.muted, fontSize: "11px", marginTop: "2px" }}>{h.assetName}</span>
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
                      {returnPct.toFixed(2)}%
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px",
                        background: h.active ? "rgba(143,214,148,0.12)" : "rgba(200,169,106,0.12)",
                        color: h.active ? C.green : C.muted }}>
                        {h.active ? "ACTIVE" : "CLOSED"}
                      </span>
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
