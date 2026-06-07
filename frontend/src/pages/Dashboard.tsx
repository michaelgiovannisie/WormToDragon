import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { API, PORTFOLIO_ID, ACCOUNT_ID } from "../constants";
import { C, PIE_COLORS, sectionStyle, labelStyle, tooltipStyle, pillStyle, tableCellStyle } from "../theme";

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary]           = useState<any>(null);
  const [holdings, setHoldings]         = useState<any[]>([]);
  const [snapshots, setSnapshots]       = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/holdings/portfolio/${PORTFOLIO_ID}/summary`)
      .then(r => r.json()).then(setSummary).catch(console.error);

    fetch(`${API}/holdings/account/${ACCOUNT_ID}`)
      .then(r => r.json()).then(setHoldings).catch(console.error);

    fetch(`${API}/portfolios/${PORTFOLIO_ID}/snapshots`)
      .then(r => r.json()).then(setSnapshots).catch(console.error);

    fetch(`${API}/transactions/account/${ACCOUNT_ID}`)
      .then(r => r.json()).then(setTransactions).catch(console.error);
  }, []);

  const trendData = snapshots.length > 0
    ? snapshots.map((s: any) => ({
        date: s.snapshotDate,
        value: Number(s.totalMarketValue ?? 0),
      }))
    : [
        { date: "Jan", value: 3200 }, { date: "Feb", value: 3500 },
        { date: "Mar", value: 4100 }, { date: "Apr", value: 4500 },
        { date: "May", value: 5200 }, { date: "Jun", value: 5805 },
      ];

  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 10);

  const metricCards = [
    { label: "Portfolio Value",  value: `$${Number(summary?.totalMarketValue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Unrealized Gain",  value: `$${Number(summary?.totalUnrealizedGain ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: Number(summary?.totalUnrealizedGain ?? 0) >= 0 ? C.green : C.red },
    { label: "Realized Gain",    value: `$${Number(summary?.totalRealizedGain ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: Number(summary?.totalRealizedGain ?? 0) >= 0 ? C.green : C.red },
    { label: "Positions",        value: String(holdings.length) },
  ];

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Portfolio Dashboard</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>
        Long-Term Compounders
      </h2>
      <p style={{ color: C.muted, marginBottom: "40px" }}>
        A refined view of capital, conviction, and performance.
      </p>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px", marginBottom: "32px" }}>
        {metricCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "28px" }}>
            <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: "28px", marginTop: "14px", marginBottom: 0, color: color ?? C.text }}>{value}</h3>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginBottom: "32px" }}>
        <section style={sectionStyle}>
          <p style={labelStyle}>Portfolio Trend</p>
          <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Value Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(200,169,106,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke={C.muted} tick={{ fontSize: 12 }} />
              <YAxis stroke={C.muted} tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Value"]} />
              <Line type="monotone" dataKey="value" stroke={C.gold} strokeWidth={3} dot={{ r: 3, fill: C.gold }} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section style={sectionStyle}>
          <p style={labelStyle}>Allocation</p>
          <h3 style={{ fontSize: "24px", margin: "8px 0 0" }}>By Position</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={holdings} dataKey="marketValue" nameKey="symbol"
                cx="50%" cy="55%" innerRadius={70} outerRadius={110} paddingAngle={3}>
                {holdings.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Value"]} />
              <Legend formatter={(v) => <span style={{ color: C.muted, fontSize: "12px" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Holdings table */}
      <section style={{ ...sectionStyle, marginBottom: "32px" }}>
        <p style={labelStyle}>Holdings</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Current Positions</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: "12px", textAlign: "left", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <th style={{ paddingBottom: "12px" }}>Symbol</th>
              <th style={{ paddingBottom: "12px" }}>Quantity</th>
              <th style={{ paddingBottom: "12px" }}>Avg Cost</th>
              <th style={{ paddingBottom: "12px" }}>Market Value</th>
              <th style={{ paddingBottom: "12px" }}>Unrealized Gain</th>
              <th style={{ paddingBottom: "12px" }}>Return %</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h: any) => {
              const gain = Number(h.unrealizedGain);
              const ret  = h.totalCostBasis > 0
                ? ((Number(h.marketValue) - Number(h.totalCostBasis)) / Number(h.totalCostBasis) * 100).toFixed(2)
                : "0.00";
              return (
                <tr key={h.id} style={{ borderTop: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                  onClick={() => navigate(`/research?symbol=${h.symbol}`)}>
                  <td style={tableCellStyle}>
                    <span style={{ color: C.gold, fontWeight: 700 }}>{h.symbol}</span>
                  </td>
                  <td style={tableCellStyle}>{Number(h.quantityHeld).toFixed(4)}</td>
                  <td style={tableCellStyle}>${Number(h.averageCostBasis).toFixed(2)}</td>
                  <td style={tableCellStyle}>${Number(h.marketValue).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...tableCellStyle, color: gain >= 0 ? C.green : C.red }}>
                    ${gain.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...tableCellStyle, color: Number(ret) >= 0 ? C.green : C.red }}>
                    {ret}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Recent transactions */}
      <section style={sectionStyle}>
        <p style={labelStyle}>Ledger</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Recent Transactions</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: "12px", textAlign: "left", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {["Date","Type","Asset","Qty","Price","Realized Gain"].map(h => (
                <th key={h} style={{ paddingBottom: "12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentTx.map((tx: any) => (
              <tr key={tx.id} style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                <td style={tableCellStyle}>{tx.transactionDate}</td>
                <td style={tableCellStyle}><span style={pillStyle(tx.transactionType)}>{tx.transactionType}</span></td>
                <td style={{ ...tableCellStyle, color: C.gold, cursor: "pointer" }}
                  onClick={() => navigate(`/research?symbol=${tx.symbol}`)}>
                  {tx.symbol}
                </td>
                <td style={tableCellStyle}>{Number(tx.quantity).toFixed(4)}</td>
                <td style={tableCellStyle}>${Number(tx.pricePerUnit).toFixed(2)}</td>
                <td style={{ ...tableCellStyle, color: Number(tx.realizedGain) >= 0 ? C.green : C.red }}>
                  ${Number(tx.realizedGain).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
