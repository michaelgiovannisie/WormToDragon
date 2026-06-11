import { C } from "../theme";
import { useHoldingsSync } from "../hooks/useHoldingsSync";

/**
 * Reusable widget for the background holdings sync.
 * Mount on Dashboard and Holdings — state is derived from the backend,
 * so both pages show the same live progress.
 */
export function HoldingsSyncWidget({ onComplete }: { onComplete?: () => void } = {}) {
  const { status, starting, start } = useHoldingsSync(onComplete);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  };

  const btnStyle: React.CSSProperties = {
    background: C.gold,
    color: "#000",
    border: "none",
    borderRadius: "10px",
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: status.state === "running" || starting ? "not-allowed" : "pointer",
    opacity: status.state === "running" || starting ? 0.6 : 1,
    whiteSpace: "nowrap" as const,
  };

  // ── Running ───────────────────────────────────────────────────────────────
  if (status.state === "running") {
    const pct = status.total > 0
      ? Math.round((status.completed / status.total) * 100)
      : 0;

    return (
      <div style={containerStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "200px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: C.gold }}>
              Syncing holdings… {status.completed}/{status.total}
            </span>
            <span style={{ fontSize: "12px", color: C.muted }}>{pct}%</span>
          </div>
          <div style={{
            height: "4px", borderRadius: "2px",
            background: "rgba(200,169,106,0.15)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${pct}%`, background: C.gold,
              borderRadius: "2px", transition: "width 0.4s ease",
            }} />
          </div>
          {status.currentSymbol && (
            <span style={{ fontSize: "11px", color: C.muted }}>{status.currentSymbol}</span>
          )}
        </div>
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (status.state === "completed") {
    const hasFailures = status.failures.length > 0;
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: "12px", color: hasFailures ? C.red : C.green }}>
          {status.summary ?? "Holdings sync complete"}
        </span>
        <button style={btnStyle} onClick={start} disabled={starting}>
          ⟳ Sync Holdings
        </button>
      </div>
    );
  }

  // ── Idle (default) ────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <button style={btnStyle} onClick={start} disabled={starting}>
        {starting ? "Starting…" : "⟳ Sync Holdings"}
      </button>
    </div>
  );
}
