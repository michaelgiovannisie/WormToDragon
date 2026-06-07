export const C = {
  bg:           "#0B1020",
  sidebar:      "#070B16",
  card:         "#11182A",
  border:       "rgba(200,169,106,0.25)",
  borderSubtle: "rgba(200,169,106,0.15)",
  gold:         "#C8A96A",
  muted:        "#9C927D",
  text:         "#F5F1E8",
  green:        "#8FD694",
  red:          "#E06C75",
  font:         "Georgia, serif",
} as const;

export const PIE_COLORS = [
  "#C8A96A", "#8FD694", "#7B9EC5", "#C97B84",
  "#B5A07A", "#6BA8A4", "#D4875A", "#9B8EA8",
];

// Reusable style blocks
export const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: "20px",
  padding: "28px",
};

export const sectionStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: "24px",
  padding: "32px",
};

export const labelStyle: React.CSSProperties = {
  color: C.gold,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  fontSize: "12px",
};

export const tableHeadStyle: React.CSSProperties = {
  color: C.muted,
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 400,
  paddingBottom: "12px",
  borderBottom: `1px solid ${C.borderSubtle}`,
};

export const tableCellStyle: React.CSSProperties = {
  padding: "16px 0",
  borderBottom: `1px solid ${C.borderSubtle}`,
  fontSize: "15px",
};

export const tooltipStyle = {
  contentStyle: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "12px",
    color: C.text,
  },
};

export const pillStyle = (type: string): React.CSSProperties => ({
  padding: "4px 12px",
  borderRadius: "999px",
  fontSize: "11px",
  letterSpacing: "0.08em",
  background:
    type === "BUY"  ? "rgba(143,214,148,0.12)" :
    type === "SELL" ? "rgba(224,108,117,0.12)" :
                      "rgba(200,169,106,0.12)",
  color:
    type === "BUY"  ? C.green :
    type === "SELL" ? C.red   :
                      C.gold,
});
