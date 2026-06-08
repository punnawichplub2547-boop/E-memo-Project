import { IconPaperclip, IconX } from "@/components/icons";

export function AttachItem({ name, size, onRemove }: { name: string; size: string; onRemove?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><IconPaperclip size={14} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{size}</div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
