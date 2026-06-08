import { C } from "../theme";
import { useNasdaq100Sync } from "../hooks/useNasdaq100Sync";

/**
 * Reusable widget for the NASDAQ-100 background batch sync.
 * Mount on Dashboard, Holdings, and Research — state is derived from the backend,
 * so all three pages show the same live progress regardless of which one started it.
 */
export function Nasdaq100SyncWidget() {
  const { status, starting, start } = useNasdaq100Sync();

  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  };

  const btnStyle: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: "8px",
    border: `1px solid ${C.gold}`,
    background: "transparent",
    color: C.gold,
    fontSize: "13px",
    cursor: "pointer",
    opacity: starting ? 0.6 : 1,
    whiteSpace: "nowrap",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    color: C.muted,
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
              Syncing NASDAQ-100… {status.completed}/{status.total}
            </span>
            <span style={{ fontSize: "12px", color: C.muted }}>{pct}%</span>
          </div>
          {/* Progress bar */}
          <div style={{
            height: "4px",
            borderRadius: "2px",
            background: "rgba(200,169,106,0.15)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: C.gold,
              borderRadius: "2px",
              transition: "width 0.4s ease",
            }} />
          </div>
          {status.currentSymbol && (
            <span style={{ fontSize: "11px", color: C.muted }}>
              {status.currentSymbol}
            </span>
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
          {status.summary ?? "NASDAQ-100 sync complete"}
        </span>
        <button style={btnStyle} onClick={start} disabled={starting}>
          Sync Again
        </button>
      </div>
    );
  }

  // ── Idle (default) ────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <button style={btnStyle} onClick={start} disabled={starting}>
        {starting ? "Starting…" : "⟳ Sync NASDAQ-100"}
      </button>
      <span style={labelStyle}>~100 stocks · runs in background</span>
    </div>
  );
}
