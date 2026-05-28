export function DecisionCell({ label, value, sub, tone = "neutral", hideRightBorder = false }: { label: string; value: string; sub?: string; tone?: "neutral" | "emerald" | "amber" | "gold"; hideRightBorder?: boolean }) {
  const color =
    tone === "emerald" ? "var(--emerald)" :
    tone === "amber" ? "var(--amber)" :
    tone === "gold" ? "#7C5E0F" :
    "var(--ink)";
  return (
    <div style={{
      padding: "12px 14px",
      borderRight: hideRightBorder ? "none" : "1px solid var(--line)",
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{sub}</div>
      )}
    </div>
  );
}
