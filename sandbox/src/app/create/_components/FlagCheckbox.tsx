export function FlagCheckbox({ checked, onChange, title, sub }: { checked: boolean; onChange: (v: boolean) => void; title: string; sub: string }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${checked ? "var(--primary)" : "var(--line-2)"}`, background: checked ? "var(--surface-soft)" : "var(--surface)", cursor: "pointer", userSelect: "none" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--primary)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
      </div>
    </label>
  );
}
