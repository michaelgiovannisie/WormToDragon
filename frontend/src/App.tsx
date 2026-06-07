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
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [assetDetail, setAssetDetail] = useState<any>(null);
  const [targetMarginOfSafetyPercent, setTargetMarginOfSafetyPercent] =
    useState(25);

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

  }, []);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    setAssetDetail(null);

    fetch(`http://localhost:8080/api/assets/${selectedSymbol}/detail`)
      .then((response) => response.json())
      .then((data) => setAssetDetail(data))
      .catch(console.error);
  }, [selectedSymbol]);

  const portfolioTrendData =
    performance.length > 0
      ? performance.map((snapshot) => ({
          date: snapshot.snapshotDate,
          totalMarketValue: Number(snapshot.totalMarketValue ?? 0)
        }))
      : portfolioData.map((point) => ({
          date: point.month,
          totalMarketValue: point.value
        }));

  if (selectedSymbol && !assetDetail) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0B1020",
          color: "#F5F1E8",
          fontFamily: "Georgia, serif",
          padding: "48px"
        }}
      >
        <button
          onClick={() => setSelectedSymbol(null)}
          style={{
            background: "transparent",
            color: "#C8A96A",
            border: "1px solid rgba(200,169,106,0.35)",
            borderRadius: "999px",
            padding: "10px 18px",
            cursor: "pointer"
          }}
        >
          ← Back to Dashboard
        </button>

        <p
          style={{
            color: "#C8A96A",
            letterSpacing: "0.3em",
            fontSize: "12px",
            textTransform: "uppercase",
            marginTop: "48px"
          }}
        >
          Asset Detail
        </p>

        <h1 style={{ fontSize: "48px", marginTop: "16px" }}>
          Loading {selectedSymbol}...
        </h1>
      </div>
    );
  }

  if (selectedSymbol && assetDetail) {
  const valuationScenarios = assetDetail.valuationScenarios ?? [];

  const bearCase = assetDetail.valuationScenarios?.find(
  (scenario: any) => scenario.caseType === "BEAR"
  );

  const baseCase = assetDetail.valuationScenarios?.find(
    (scenario: any) => scenario.caseType === "BASE"
  );

  const bullCase = assetDetail.valuationScenarios?.find(
    (scenario: any) => scenario.caseType === "BULL"
  );

  const latestValuation = baseCase ?? valuationScenarios[0];

  const buyBelowPrice =
    latestValuation?.intrinsicValue == null
      ? 0
      : Number(latestValuation.intrinsicValue) *
        (1 - targetMarginOfSafetyPercent / 100);

  const recentValuationScenarios = valuationScenarios.slice(0, 5);
  const taxLots = assetDetail.taxLots ?? [];
  const taxLotAllocations = assetDetail.taxLotAllocations ?? [];

  const valuationTrendData =
    [...recentValuationScenarios]
      .reverse()
      .map((scenario: any) => ({
        date: new Date(scenario.createdAt).toLocaleDateString(),
        intrinsicValue: Number(scenario.intrinsicValue ?? 0),
        caseType: scenario.caseType ?? "-"
      }));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B1020",
        color: "#F5F1E8",
        fontFamily: "Georgia, serif",
        padding: "48px"
      }}
    >
      <button
        onClick={() => setSelectedSymbol(null)}
        style={{
          background: "transparent",
          color: "#C8A96A",
          border: "1px solid rgba(200,169,106,0.35)",
          borderRadius: "999px",
          padding: "10px 18px",
          cursor: "pointer"
        }}
      >
        ← Back to Dashboard
      </button>

      <p
        style={{
          color: "#C8A96A",
          letterSpacing: "0.3em",
          fontSize: "12px",
          textTransform: "uppercase",
          marginTop: "48px"
        }}
      >
        Asset Detail
      </p>

      <h1 style={{ fontSize: "64px", marginTop: "16px" }}>
        {assetDetail.symbol}
      </h1>

      <p style={{ color: "#9C927D" }}>
        {assetDetail.assetName}
      </p>

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
            "Market Value",
            `$${Number(assetDetail.holding?.marketValue ?? 0).toFixed(2)}`
          ],
          [
            "Intrinsic Value",
            `$${Number(latestValuation?.intrinsicValue ?? 0).toFixed(2)}`
          ],
          [
            "Current MOS",
            `${Number(latestValuation?.marginOfSafetyPercent ?? 0).toFixed(2)}%`
          ],
          [
            `Buy Below (${targetMarginOfSafetyPercent}% MOS)`,
            `$${buyBelowPrice.toFixed(2)}`
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
            <p style={{ color: "#9C927D", fontSize: "14px" }}>{label}</p>
            <h3 style={{ fontSize: "30px", marginTop: "16px" }}>{value}</h3>
          </div>
        ))}
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
        Valuation Range
      </p>

      <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
        Bear / Base / Bull
      </h3>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "12px"
        }}
      >
        <label style={{ color: "#9C927D" }}>
          Target MOS
        </label>

        <input
          type="number"
          min="0"
          max="90"
          value={targetMarginOfSafetyPercent}
          onChange={(event) =>
            setTargetMarginOfSafetyPercent(Number(event.target.value))
          }
          style={{
            width: "90px",
            background: "#0B1020",
            color: "#F5F1E8",
            border: "1px solid rgba(200,169,106,0.35)",
            borderRadius: "10px",
            padding: "8px 10px"
          }}
        />

        <span style={{ color: "#9C927D" }}>%</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
          marginTop: "28px"
        }}
      >
        {[
          ["Bear Case", bearCase],
          ["Base Case", baseCase],
          ["Bull Case", bullCase]
        ].map(([label, scenario]: any) => (
          <div
            key={label}
            style={{
              border: "1px solid rgba(200,169,106,0.18)",
              borderRadius: "18px",
              padding: "24px"
            }}
          >
            <p style={{ color: "#9C927D", fontSize: "14px" }}>
              {label}
            </p>

            <h4 style={{ fontSize: "28px", marginTop: "12px" }}>
              ${Number(scenario?.intrinsicValue ?? 0).toFixed(2)}
            </h4>

            <p style={{ color: "#9C927D", marginTop: "12px" }}>
              MOS: {Number(scenario?.marginOfSafetyPercent ?? 0).toFixed(2)}%
            </p>

            <p style={{ color: "#9C927D", marginTop: "8px" }}>
              Buy Below: $
              {(
                Number(scenario?.intrinsicValue ?? 0) *
                (1 - targetMarginOfSafetyPercent / 100)
              ).toFixed(2)}
            </p>

            <p style={{ color: "#9C927D", marginTop: "8px", fontSize: "13px" }}>
              Growth {scenario?.growthRatePercent ?? "-"}% · Discount{" "}
              {scenario?.discountRatePercent ?? "-"}% · Multiple{" "}
              {scenario?.terminalMultiple ?? "-"}x
            </p>
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
            Asset Ledger
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            {assetDetail.symbol} Transactions
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
                <th>Date</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Realized Gain</th>
              </tr>
            </thead>

            <tbody>
              {assetDetail.transactions.map((transaction: any) => (
                <tr
                  key={transaction.id}
                  style={{
                    borderTop: "1px solid rgba(200,169,106,0.15)"
                  }}
                >
                  <td style={{ padding: "18px 0" }}>
                    {transaction.transactionDate}
                  </td>
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
                  <td>{transaction.quantity}</td>
                  <td>${Number(transaction.pricePerUnit).toFixed(2)}</td>
                  <td>${Number(transaction.realizedGain).toFixed(2)}</td>
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
          <p
            style={{
              color: "#C8A96A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontSize: "12px"
            }}
          >
            Tax Lots
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Open Lots
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
                <th>Acquired</th>
                <th>Purchased</th>
                <th>Remaining</th>
                <th>Cost / Share</th>
                <th>Lot Cost</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {taxLots.length === 0 ? (
                <tr style={{ borderTop: "1px solid rgba(200,169,106,0.15)" }}>
                  <td
                    colSpan={6}
                    style={{ padding: "18px 0", color: "#9C927D" }}
                  >
                    No tax lots yet.
                  </td>
                </tr>
              ) : (
                taxLots.map((lot: any) => (
                  <tr
                    key={lot.id}
                    style={{
                      borderTop: "1px solid rgba(200,169,106,0.15)"
                    }}
                  >
                    <td style={{ padding: "18px 0" }}>{lot.acquisitionDate}</td>
                    <td>{Number(lot.quantityPurchased).toFixed(4)}</td>
                    <td>{Number(lot.quantityRemaining).toFixed(4)}</td>
                    <td>${Number(lot.costBasisPerUnit).toFixed(2)}</td>
                    <td>${Number(lot.totalCostBasis).toFixed(2)}</td>
                    <td>
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          letterSpacing: "0.08em",
                          background: lot.closed
                            ? "rgba(201,112,100,0.15)"
                            : "rgba(127,176,105,0.15)",
                          color: lot.closed ? "#E06C75" : "#8FD694"
                        }}
                      >
                        {lot.closed ? "CLOSED" : "OPEN"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
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
          <p
            style={{
              color: "#C8A96A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontSize: "12px"
            }}
          >
            FIFO Allocations
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Realized Gain Audit
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
                <th>Quantity</th>
                <th>Proceeds</th>
                <th>Cost Basis</th>
                <th>Realized Gain</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {taxLotAllocations.length === 0 ? (
                <tr style={{ borderTop: "1px solid rgba(200,169,106,0.15)" }}>
                  <td
                    colSpan={5}
                    style={{ padding: "18px 0", color: "#9C927D" }}
                  >
                    No FIFO allocations yet.
                  </td>
                </tr>
              ) : (
                taxLotAllocations.map((allocation: any) => (
                  <tr
                    key={allocation.id}
                    style={{
                      borderTop: "1px solid rgba(200,169,106,0.15)"
                    }}
                  >
                    <td style={{ padding: "18px 0" }}>
                      {Number(allocation.quantityAllocated).toFixed(4)}
                    </td>
                    <td>${Number(allocation.proceeds).toFixed(2)}</td>
                    <td>${Number(allocation.costBasis).toFixed(2)}</td>
                    <td
                      style={{
                        color:
                          Number(allocation.realizedGain) >= 0
                            ? "#8FD694"
                            : "#E06C75"
                      }}
                    >
                      ${Number(allocation.realizedGain).toFixed(2)}
                    </td>
                    <td>
                      {new Date(allocation.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
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
          <p
            style={{
              color: "#C8A96A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontSize: "12px"
            }}
          >
            Valuation History
          </p>

          <h3 style={{ fontSize: "28px", marginTop: "8px" }}>
            Intrinsic Value Over Time
          </h3>

          <div style={{ height: "280px", marginTop: "32px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={valuationTrendData}>
                <CartesianGrid stroke="rgba(200,169,106,0.12)" />
                <XAxis dataKey="date" stroke="#9C927D" />
                <YAxis stroke="#9C927D" />
                <Tooltip
                  contentStyle={{
                    background: "#0B1020",
                    border: "1px solid rgba(200,169,106,0.25)",
                    color: "#F5F1E8"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="intrinsicValue"
                  stroke="#C8A96A"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ fontSize: "24px", marginTop: "40px" }}>
            Saved Scenarios
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
                <th>Date</th>
                <th>Case</th>
                <th>Intrinsic Value</th>
                <th>MOS</th>
                <th>Assumptions</th>
                <th>Label</th>
              </tr>
            </thead>

            <tbody>
              {recentValuationScenarios.map((scenario: any) => (
                <tr
                  key={scenario.id}
                  style={{
                    borderTop: "1px solid rgba(200,169,106,0.15)"
                  }}
                >
                  <td style={{ padding: "18px 0" }}>
                    {new Date(scenario.createdAt).toLocaleDateString()}
                  </td>
                  <td>{scenario.caseType ?? "-"}</td>
                  <td>${Number(scenario.intrinsicValue).toFixed(2)}</td>
                  <td>{Number(scenario.marginOfSafetyPercent).toFixed(2)}%</td>
                  <td>
                    Growth {scenario.growthRatePercent ?? "-"}% / Discount{" "}
                    {scenario.discountRatePercent ?? "-"}% / Multiple{" "}
                    {scenario.terminalMultiple ?? "-"}x
                  </td>
                  <td>{scenario.valuationLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

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
            <LineChart data={portfolioTrendData}>
              <CartesianGrid
                stroke="rgba(200,169,106,0.08)"
                vertical={false}
              />

              <XAxis dataKey="date" stroke="#9C927D" />

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
                <th>Quantity</th>
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
                  <td
                    onClick={() => setSelectedSymbol(holding.symbol)}
                    style={{
                      padding: "18px 0",
                      color: "#C8A96A",
                      cursor: "pointer",
                      fontWeight: 700
                    }}
                  >
                    {holding.symbol}
                  </td>
                  <td>{holding.quantityHeld}</td>
                  <td>${Number(holding.averageCostBasis).toFixed(2)}</td>
                  <td>${Number(holding.marketValue).toFixed(2)}</td>
                  <td
                  style={{
                    color:
                      Number(holding.unrealizedGain) >= 0
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
