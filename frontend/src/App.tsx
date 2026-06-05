import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { useEffect, useState } from "react";

const portfolioData = [
  { month: "Jan", value: 3200 },
  { month: "Feb", value: 3500 },
  { month: "Mar", value: 4100 },
  { month: "Apr", value: 4500 },
  { month: "May", value: 5200 },
  { month: "Jun", value: 5805 }
];

const PORTFOLIO_ID =
  "a32e04b9-9270-45d2-a16f-34b6389dc464";

const ACCOUNT_ID =
  "f5afd398-4c6d-4fa7-8493-5031bc7d27ec";

function App() {
  const [summary, setSummary] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [valuation, setValuation] = useState<any>(null);

  useEffect(() => {
    fetch(
      `http://localhost:8080/api/holdings/portfolio/${PORTFOLIO_ID}/summary`
    )
      .then((response) => response.json())
      .then((data) => {
        console.log("SUMMARY DATA:", data);
        setSummary(data);
      })
      .catch(console.error);

    fetch(
      `http://localhost:8080/api/holdings/account/${ACCOUNT_ID}`
    )
      .then((response) => response.json())
      .then((data) => setHoldings(data))
      .catch(console.error);

    fetch(
      `http://localhost:8080/api/portfolios/${PORTFOLIO_ID}/snapshots`
    )
      .then((response) => response.json())
      .then((data) => setPerformance(data))
      .catch(console.error);

    fetch(
      `http://localhost:8080/api/transactions/account/${ACCOUNT_ID}`
    )
      .then((response) => response.json())
      .then((data) => setTransactions(data))
      .catch(console.error);

    fetch("http://localhost:8080/api/valuations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        symbol: "AAPL",
        currentPrice: 370,
        earningsPerShare: 7.5,
        growthRatePercent: 8,
        discountRatePercent: 10,
        years: 10,
        terminalMultiple: 22
      })
    })
      .then((response) => response.json())
      .then((data) => setValuation(data))
      .catch(console.error);

  }, []);
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B1020",
        color: "#F5F1E8",
        fontFamily: "Georgia, serif"
      }}
    >
      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "260px",
          height: "100vh",
          background: "#070B16",
          borderRight: "1px solid rgba(200,169,106,0.25)",
          padding: "32px",
          boxSizing: "border-box"
        }}
      >
        <h1
          style={{
            color: "#C8A96A",
            fontSize: "32px"
          }}
        >
          Conviction
        </h1>

        <p style={{ color: "#9C927D" }}>
          Investment Intelligence
        </p>
      </aside>

      <main
        style={{
          marginLeft: "260px",
          padding: "48px"
        }}
      >
        <p
          style={{
            color: "#C8A96A",
            letterSpacing: "0.3em",
            fontSize: "12px",
            textTransform: "uppercase"
          }}
        >
          Portfolio Dashboard
        </p>

        <h2
          style={{
            fontSize: "56px",
            marginTop: "16px"
          }}
        >
          Long-Term Compounders
        </h2>

        <p
          style={{
            color: "#9C927D",
            marginTop: "12px"
          }}
        >
          A refined view of capital, conviction, and performance.
        </p>

        {/* Cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "24px",
            marginTop: "48px"
          }}
        >
          {[
            [
              "Portfolio Value",
              `$${Number(summary?.totalMarketValue ?? 0).toFixed(2)}`
            ],
            [
              "Unrealized Gain",
              `$${Number(summary?.totalUnrealizedGain ?? 0).toFixed(2)}`
            ],
            [
              "Top Holding",
              summary?.topHoldingSymbol ?? "-"
            ],
            [
              "Health Score",
              summary?.portfolioHealthLabel ?? "-"
            ]
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#11182A",
                border: "1px solid rgba(200,169,106,0.25)",
                borderRadius: "20px",
                padding: "28px"
              }}
            >
              <p
                style={{
                  color: "#9C927D",
                  fontSize: "14px"
                }}
              >
                {label}
              </p>

              <h3
                style={{
                  fontSize: "30px",
                  marginTop: "16px"
                }}
              >
                {value}
              </h3>
            </div>
          ))}
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "24px",
            marginTop: "48px"
          }}
        >

        <section
          style={{
            marginTop: "48px",
            background: "#11182A",
            border: "1px solid rgba(200,169,106,0.25)",
            borderRadius: "24px",
            padding: "32px",
            minHeight: "420px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "24px"
            }}
          >
            <div>
              <p
                style={{
                  color: "#C8A96A",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontSize: "12px"
                }}
              >
                Portfolio Trend
              </p>

              <h3
                style={{
                  fontSize: "28px",
                  marginTop: "8px"
                }}
              >
                Portfolio Value
              </h3>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={performance.length > 0 ? performance : portfolioData}>
              <CartesianGrid
                stroke="rgba(200,169,106,0.08)"
                vertical={false}
              />

              <XAxis dataKey="snapshotDate" stroke="#9C927D" />

              <YAxis
                stroke="#9C927D"
              />

              <Tooltip
                contentStyle={{
                  background: "#11182A",
                  border: "1px solid rgba(200,169,106,0.25)",
                  borderRadius: "12px",
                  color: "#F5F1E8"
                }}
              />

              <Line
                type="monotone"
                dataKey="totalMarketValue"
                stroke="#C8A96A"
                strokeWidth={4}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

                <section
          style={{
            marginTop: "48px",
            background: "#11182A",
            border: "1px solid rgba(200,169,106,0.25)",
            borderRadius: "24px",
            padding: "32px",
            minHeight: "420px"
          }}
        >
          <p
            style={{
              color: "#C8A96A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontSize: "12px"
            }}
          >
            Allocation
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Portfolio Allocation
          </h3>

          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={holdings}
                dataKey="marketValue"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={3}
              >
                {holdings.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index % 2 === 0 ? "#C8A96A" : "#F5F1E8"}
                  />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  background: "#11182A",
                  border: "1px solid rgba(200,169,106,0.25)",
                  borderRadius: "12px",
                  color: "#F5F1E8"
                }}
              />

              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </section>
        </div>

        <section
          style={{
            marginTop: "48px",
            background: "#11182A",
            border: "1px solid rgba(200,169,106,0.25)",
            borderRadius: "24px",
            padding: "32px"
          }}
        >
          <p
            style={{
              color: "#C8A96A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontSize: "12px"
            }}
          >
            Valuation Lab
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Margin of Safety
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "24px",
              marginTop: "28px"
            }}
          >
            {[
              [
                "Intrinsic Value",
                `$${Number(valuation?.intrinsicValue ?? 0).toFixed(2)}`
              ],
              [
                "Margin of Safety",
                `${Number(valuation?.marginOfSafetyPercent ?? 0).toFixed(2)}%`
              ],
              [
                "Valuation",
                valuation?.valuationLabel ?? "-"
              ]
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid rgba(200,169,106,0.18)",
                  borderRadius: "18px",
                  padding: "24px"
                }}
              >
                <p style={{ color: "#9C927D", fontSize: "14px" }}>{label}</p>
                <h4 style={{ fontSize: "26px", marginTop: "12px" }}>{value}</h4>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: "48px",
            background: "#11182A",
            border: "1px solid rgba(200,169,106,0.25)",
            borderRadius: "24px",
            padding: "32px"
          }}
        >
          <p
            style={{
              color: "#C8A96A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontSize: "12px"
            }}
          >
            Holdings
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Current Positions
          </h3>

          <table
            style={{
              width: "100%",
              marginTop: "28px",
              borderCollapse: "collapse"
            }}
          >
            <thead>
              <tr style={{ color: "#9C927D", textAlign: "left" }}>
                <th>Symbol</th>
                <th>Shares</th>
                <th>Avg Cost</th>
                <th>Market Value</th>
                <th>Unrealized Gain</th>
              </tr>
            </thead>

            <tbody>
              {holdings.map((holding) => (
                <tr
                  key={holding.id}
                  style={{
                    borderTop: "1px solid rgba(200,169,106,0.15)"
                  }}
                >
                  <td style={{ padding: "18px 0", color: "#F5F1E8" }}>
                    {holding.symbol}
                  </td>
                  <td>{holding.quantityHeld}</td>
                  <td>${Number(holding.averageCostBasis).toFixed(2)}</td>
                  <td>${Number(holding.marketValue).toFixed(2)}</td>
                  <td
                  style={{
                    color:
                      Number(holding.unrealizedGain) < 0
                        ? "#8FD694"
                        : "#E06C75"
                  }}
                >
                  ${Number(holding.unrealizedGain).toFixed(2)}
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section
          style={{
            marginTop: "48px",
            background: "#11182A",
            border: "1px solid rgba(200,169,106,0.25)",
            borderRadius: "24px",
            padding: "32px"
          }}
        >
          <p style={{
            color: "#C8A96A",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontSize: "12px"
          }}>
            Ledger
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Recent Transactions
          </h3>

          <table style={{ width: "100%", marginTop: "28px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#9C927D", textAlign: "left" }}>
                <th>Date</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Realized Gain</th>
              </tr>
            </thead>

            <tbody>
              {[...transactions]
                .sort(
                  (a, b) =>
                    new Date(b.transactionDate).getTime() -
                    new Date(a.transactionDate).getTime()
                )
                .map((transaction) => (
                <tr key={transaction.id} style={{ borderTop: "1px solid rgba(200,169,106,0.15)" }}>
                  <td style={{ padding: "18px 0" }}>{transaction.transactionDate}</td>
                  <td>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        letterSpacing: "0.08em",
                        background:
                          transaction.transactionType === "BUY"
                            ? "rgba(127,176,105,0.15)"
                            : transaction.transactionType === "SELL"
                            ? "rgba(201,112,100,0.15)"
                            : "rgba(200,169,106,0.15)",
                        color:
                          transaction.transactionType === "BUY"
                            ? "#8FD694"
                            : transaction.transactionType === "SELL"
                            ? "#E06C75"
                            : "#C8A96A"
                      }}
                    >
                      {transaction.transactionType}
                    </span>
                  </td>
                  <td>{transaction.symbol}</td>
                  <td>{transaction.quantity}</td>
                  <td>${Number(transaction.pricePerUnit).toFixed(2)}</td>
                  <td
                  style={{
                    color:
                      Number(transaction.realizedGain) >= 0
                        ? "#7FB069"
                        : "#C97064"
                  }}
                >
                  ${Number(transaction.realizedGain).toFixed(2)}
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default App;