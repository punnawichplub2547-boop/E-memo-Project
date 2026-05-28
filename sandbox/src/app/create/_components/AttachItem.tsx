import { IconPaperclip, IconX } from "@/components/icons";

export function AttachItem({ name, size }: { name: string; size: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><IconPaperclip size={14} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{size}</div>
      </div>
      <IconX size={14} style={{ color: "var(--muted)" }} />
    </div>
  );
}
