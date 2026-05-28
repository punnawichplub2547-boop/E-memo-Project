export function StepDot({ n, label, active }: { n: string; label: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: active ? "var(--primary-grad)" : "var(--surface)", color: active ? "#fff" : "var(--muted)", border: active ? 0 : "1px solid var(--line-2)", fontSize: 11, fontWeight: 700, boxShadow: active ? "0 4px 10px -2px rgba(37,99,235,0.45)" : "none" }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--ink)" : "var(--muted)" }}>{label}</div>
    </div>
  );
}
