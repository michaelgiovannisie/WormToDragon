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

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Portfolio</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Holdings</h2>
      <p style={{ color: C.muted, marginBottom: "40px" }}>All current positions across your account.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", marginBottom: "32px" }}>
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
            <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: "26px", marginTop: "14px", marginBottom: 0, color: color ?? C.text }}>{value}</h3>
          </div>
        ))}
      </div>

      <section style={sectionStyle}>
        <p style={labelStyle}>Positions</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>
          {sorted.length} {sorted.length === 1 ? "Position" : "Positions"}
        </h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "center" }}>
              <th style={th("symbol", "Symbol")}        onClick={() => toggleSort("symbol")}>Symbol{arrow("symbol")}</th>
              <th style={th(null, "30d")}                                                   >30D</th>
              <th style={th("dayChangePct", "Day")}     onClick={() => toggleSort("dayChangePct")}>Day<br/>Chg{arrow("dayChangePct")}</th>
              <th style={th("quantityHeld", "Qty")}     onClick={() => toggleSort("quantityHeld")}>Qty{arrow("quantityHeld")}</th>
              <th style={th("averageCostBasis", "Avg")} onClick={() => toggleSort("averageCostBasis")}>Avg<br/>Cost{arrow("averageCostBasis")}</th>
              <th style={th("marketValue", "Value")}    onClick={() => toggleSort("marketValue")}>Mkt<br/>Value{arrow("marketValue")}</th>
              <th style={th(null, "Price")}                                                   >Mkt<br/>Price</th>
              <th style={th("unrealizedGain", "Gain")}  onClick={() => toggleSort("unrealizedGain")}>Unreal.<br/>Gain{arrow("unrealizedGain")}</th>
              <th style={th(null, "Return")}                                                  >Return<br/>%</th>
              <th style={th(null, "Held")}                                                   >Held</th>
              <th style={th(null, "Alloc")}                                                  >Alloc<br/>%</th>
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
    </div>
  );
}
