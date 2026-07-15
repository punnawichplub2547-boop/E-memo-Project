import React, { useState } from "react";
import { IconX, IconCheck } from "@/components/icons";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  isSaving: boolean;
}

export function SaveTemplateModal({ isOpen, onClose, onSave, isSaving }: SaveTemplateModalProps) {
  const [name, setName] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name);
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
          <div className="em-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>ชื่อแม่แบบ</label>
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
            <p style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", lineHeight: "1.4" }}>
              ข้อมูลฟอร์มปัจจุบันทั้งหมด (เช่น รายการสินค้า หมวดหมู่ แผนก และราคาเปรียบเทียบ) จะถูกบันทึกเพื่อนำมาสร้างเป็นเมโมใบใหม่ในรอบหน้า (ยกเว้นเอกสารแนบและวันที่)
            </p>
          </div>
          <div className="em-modal-footer">
            <button type="button" className="em-btn secondary" onClick={onClose} disabled={isSaving}>
              ยกเลิก
            </button>
            <button type="submit" className="em-btn primary" disabled={isSaving || !name.trim()}>
              <IconCheck size={14} /> {isSaving ? "กำลังบันทึก..." : "บันทึกแม่แบบ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
