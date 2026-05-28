export function VatPill({ enabled, vatAmount, onChange }: { enabled: boolean; vatAmount: number; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", userSelect: "none" }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        aria-label="VAT 7%"
      />
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 999,
        background: enabled ? "var(--gold-soft)" : "var(--surface-2)",
        border: `1px solid ${enabled ? "rgba(201,168,76,0.45)" : "var(--line-2)"}`,
        fontSize: 11, fontWeight: 700,
        color: enabled ? "#7C5E0F" : "var(--muted)",
        letterSpacing: "0.02em",
        transition: "all 180ms ease",
        boxShadow: enabled ? "0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 6px -3px rgba(201,168,76,0.45)" : "none",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: enabled ? "#C9A84C" : "transparent",
          border: enabled ? "0" : "1.5px solid var(--muted-2, #94a3b8)",
          boxShadow: enabled ? "0 0 0 2px rgba(201,168,76,0.18)" : "none",
          transition: "all 180ms ease",
        }} />
        VAT 7%
      </span>
      {enabled && vatAmount > 0 && (
        <span style={{ fontSize: 10, color: "#7C5E0F", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          +฿{vatAmount.toLocaleString()}
        </span>
      )}
    </label>
  );
}
