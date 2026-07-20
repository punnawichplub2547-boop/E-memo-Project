import React, { useState } from "react";
import { IconX, IconCheck } from "@/components/icons";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, overwriteId?: number | null) => void;
  isSaving: boolean;
  loadedTemplateId?: number | null;
  loadedTemplateName?: string;
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
  loadedTemplateId,
  loadedTemplateName,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [saveMode, setSaveMode] = useState<"overwrite" | "new">("new");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setName(loadedTemplateName || "");
      setSaveMode(loadedTemplateId ? "overwrite" : "new");
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), saveMode === "overwrite" ? loadedTemplateId : null);
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
            
            {loadedTemplateId && (
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
                      setName(loadedTemplateName || "");
                    }}
                    disabled={isSaving}
                  />
                  <span>บันทึกทับแม่แบบเดิม (&quot;{loadedTemplateName}&quot;)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--ink)" }}>
                  <input
                    type="radio"
                    name="saveMode"
                    value="new"
                    checked={saveMode === "new"}
                    onChange={() => {
                      setSaveMode("new");
                      if (name === loadedTemplateName) setName("");
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
            
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: "1.4" }}>
              {saveMode === "overwrite"
                ? `แม่แบบ "${loadedTemplateName}" จะถูกปรับปรุงด้วยข้อมูลแบบฟอร์มปัจจุบันที่คุณแก้ไข (ยกเว้นเอกสารแนบและวันที่)`
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

