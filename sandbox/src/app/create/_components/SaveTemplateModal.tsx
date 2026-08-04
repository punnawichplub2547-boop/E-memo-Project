import React, { useState } from "react";
import { IconX, IconCheck } from "@/components/icons";
import type { MemoTemplateSummary } from "@/lib/db-templates";
import { findExactNameMatch } from "@/lib/template-filters";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, overwriteId?: number | null) => void;
  isSaving: boolean;
  loadedTemplateId?: number | null;
  loadedTemplateName?: string;
  templates: MemoTemplateSummary[];
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
  loadedTemplateId,
  loadedTemplateName,
  templates,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [saveMode, setSaveMode] = useState<"overwrite" | "new">("new");
  // Which template "overwrite" would replace: the one loaded into the form, or
  // one the user picked from the exact-name offer below.
  const [overwriteTarget, setOverwriteTarget] = useState<{ id: number; name: string } | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setName(loadedTemplateName || "");
      setSaveMode(loadedTemplateId ? "overwrite" : "new");
      setOverwriteTarget(loadedTemplateId ? { id: loadedTemplateId, name: loadedTemplateName || "" } : null);
    }
  }

  if (!isOpen) return null;

  // Derived in render (React 19 rule): no effect resets this when name changes.
  // Users name templates by month on purpose, so a near-identical name is fine
  // and silent - only an exact match offers to overwrite, and never blocks.
  const exactMatch = findExactNameMatch(templates, name);
  const showOverwriteOffer = saveMode === "new" && exactMatch !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), saveMode === "overwrite" ? overwriteTarget?.id ?? null : null);
  };

  return (
    <div className="em-modal-overlay">
      <div className="em-modal-card">
        <div className="em-modal-header">
          <h3>บันทึกเป็นแม่แบบ (Save Template)</h3>
          <button type="button" className="em-modal-close" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="em-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {overwriteTarget && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>โหมดการบันทึก (Save Mode)</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--ink)" }}>
                  <input
                    type="radio"
                    name="saveMode"
                    value="overwrite"
                    checked={saveMode === "overwrite"}
                    onChange={() => {
                      setSaveMode("overwrite");
                      setName(overwriteTarget.name);
                    }}
                    disabled={isSaving}
                  />
                  <span>บันทึกทับแม่แบบเดิม (&quot;{overwriteTarget.name}&quot;)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--ink)" }}>
                  <input
                    type="radio"
                    name="saveMode"
                    value="new"
                    checked={saveMode === "new"}
                    onChange={() => {
                      setSaveMode("new");
                      if (name === overwriteTarget.name) setName("");
                    }}
                    disabled={isSaving}
                  />
                  <span>บันทึกเป็นแม่แบบใหม่</span>
                </label>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                {saveMode === "overwrite" ? "ชื่อแม่แบบ (แก้ไขชื่อได้)" : "ชื่อแม่แบบ"}
              </label>
              <input
                type="text"
                className="em-input"
                placeholder="เช่น ขอซื้อวัสดุสิ้นเปลืองประจำเดือน"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSaving}
                autoFocus
                style={{ width: "100%" }}
              />
            </div>
            
            {showOverwriteOffer && exactMatch && (
              <div className="em-template-overwrite-offer">
                <span>มีแม่แบบชื่อ &quot;{exactMatch.name}&quot; อยู่แล้ว — จะบันทึกทับอันเดิมหรือเก็บเป็นอันใหม่ก็ได้</span>
                <button
                  type="button"
                  className="em-template-overwrite-btn"
                  disabled={isSaving}
                  onClick={() => {
                    setOverwriteTarget({ id: exactMatch.id, name: exactMatch.name });
                    setSaveMode("overwrite");
                    setName(exactMatch.name);
                  }}
                >
                  ทับอันเดิม
                </button>
              </div>
            )}

            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: "1.4" }}>
              {saveMode === "overwrite" && overwriteTarget
                ? `แม่แบบ "${overwriteTarget.name}" จะถูกปรับปรุงด้วยข้อมูลแบบฟอร์มปัจจุบันที่คุณแก้ไข (ยกเว้นเอกสารแนบและวันที่)`
                : "ข้อมูลฟอร์มปัจจุบันทั้งหมด (เช่น รายการสินค้า หมวดหมู่ แผนก และราคาเปรียบเทียบ) จะถูกบันทึกเพื่อนำมาสร้างเป็นแม่แบบใหม่ในรอบหน้า (ยกเว้นเอกสารแนบและวันที่)"}
            </p>
          </div>
          <div className="em-modal-footer">
            <button type="button" className="em-btn secondary" onClick={onClose} disabled={isSaving}>
              ยกเลิก
            </button>
            <button type="submit" className="em-btn primary" disabled={isSaving || !name.trim()}>
              <IconCheck size={14} /> {isSaving ? "กำลังบันทึก..." : saveMode === "overwrite" ? "อัปเดตแม่แบบ" : "บันทึกแม่แบบใหม่"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

