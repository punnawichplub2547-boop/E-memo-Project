import { IconArrowRight, IconCircle } from "@/components/icons";

export function MiniStep({ title, sub, current, firstMandatory }: { title: string; sub: string; current?: boolean; firstMandatory?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: current ? "var(--primary-soft)" : "transparent", border: current ? "1px solid var(--primary-soft)" : "1px solid transparent" }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: current ? "var(--primary-grad)" : "var(--slate-soft)", color: current ? "#fff" : "var(--muted)", flexShrink: 0 }}>
        {current ? <IconArrowRight size={12} /> : <IconCircle size={10} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {firstMandatory && (<span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--rose)", background: "var(--rose-soft)", padding: "1px 6px", borderRadius: 999, letterSpacing: "0.05em" }}>MANDATORY</span>)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
      </div>
    </div>
  );
}
