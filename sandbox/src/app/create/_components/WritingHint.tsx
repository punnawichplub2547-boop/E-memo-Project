export function WritingHint({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ padding: "8px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "rgba(255,255,255,0.72)", boxShadow: "0 1px 0 rgba(255,255,255,0.75) inset" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--primary)", boxShadow: "0 0 0 3px rgba(37,99,235,0.10)" }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink)", letterSpacing: "0.03em" }}>{title}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}
