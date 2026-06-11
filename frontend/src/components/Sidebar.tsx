import { NavLink } from "react-router-dom";
import { C } from "../theme";

const NAV = [
  { to: "/",            label: "Dashboard"    },
  { to: "/holdings",    label: "Holdings"     },
  { to: "/research",    label: "Research"     },
  { to: "/screener",    label: "Screener"     },
  { to: "/benchmarking", label: "Benchmarking" },
  { to: "/tax",         label: "Tax"          },
  { to: "/import",        label: "Import"       },
];

export default function Sidebar() {
  return (
    <aside style={{
      position: "fixed",
      left: 0, top: 0,
      width: "240px",
      height: "100vh",
      background: C.sidebar,
      borderRight: `1px solid ${C.border}`,
      padding: "36px 28px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "0",
    }}>
      <div style={{ marginBottom: "48px" }}>
        <h1 style={{ color: C.gold, fontSize: "26px", margin: 0, letterSpacing: "0.04em" }}>
          Conviction
        </h1>
        <p style={{ color: C.muted, fontSize: "12px", marginTop: "6px", letterSpacing: "0.08em" }}>
          Investment Intelligence
        </p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            style={({ isActive }) => ({
              display: "block",
              padding: "10px 14px",
              borderRadius: "10px",
              color: isActive ? C.gold : C.muted,
              background: isActive ? "rgba(200,169,106,0.08)" : "transparent",
              textDecoration: "none",
              fontSize: "15px",
              fontFamily: C.font,
              letterSpacing: "0.02em",
              transition: "all 0.15s",
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
