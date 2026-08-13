import type React from "react";
import { useState } from "react";
import { IconBell, IconUpload } from "@/components/icons";
import { formatAttachmentSize } from "@/lib/attachments";
import { MAX_NOTIFY_NOTE_CHARS, MAX_NOTIFY_NOTE_IMAGES, validateNotifyNoteImageFiles } from "@/lib/notify-note";
import { AttachItem } from "./AttachItem";
import { FlagCheckbox } from "./FlagCheckbox";

/**
 * "เรื่องเพิ่มเติม" — a short note (+ optional images, + optional Excel attach flag)
 * delivered with the FIRST submit notification only (email/Telegram/in-app bell).
 *
 * Deliberately NOT part of the memo document itself: it never appears in the memo
 * body, the queue drawer, or the F-DC-006 Excel export (V2 §3, Q14). This card must
 * say so on screen — without that notice a user would reasonably assume they are
 * writing into the document.
 */
export function NotifyNoteCard({
  note,
  onNoteChange,
  images,
  onImagesChange,
  attachExcel,
  onAttachExcelChange,
  uploadError,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  images: File[];
  onImagesChange: (files: File[]) => void;
  attachExcel: boolean;
  onAttachExcelChange: (value: boolean) => void;
  /** Server-side upload failure (blocks submit); distinct from the local client-side
   *  validation error below, which fires before anything is ever sent. */
  uploadError?: string | null;
}) {
  const [imageError, setImageError] = useState<string | null>(null);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    const merged = [...images, ...picked];
    const validation = validateNotifyNoteImageFiles(
      merged.map((file) => ({ name: file.name, type: file.type, size: file.size }))
    );
    if (!validation.ok) {
      setImageError(validation.message);
      return;
    }
    setImageError(null);
    onImagesChange(merged);
  };

  const removeImage = (index: number) => {
    setImageError(null);
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="em-card">
      <div className="em-card-head" style={{ padding: "14px 18px" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <IconBell size={14} />
            </span>
            เรื่องเพิ่มเติม / Notification note
          </h3>
          <div className="em-sub" style={{ marginTop: 2 }}>
            ข้อความนี้จะไปกับการแจ้งเตือนตอนส่งเท่านั้น ไม่ขึ้นในตัวเมโมและไม่ขึ้นในฟอร์ม Excel
          </div>
        </div>
      </div>
      <div className="em-card-body" style={{ padding: "10px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="em-field">
          <label className="em-label">ข้อความเรื่องเพิ่มเติม (ไม่บังคับ)</label>
          <textarea
            className="em-textarea"
            style={{ minHeight: 100, lineHeight: 1.6, padding: "12px 13px" }}
            value={note}
            maxLength={MAX_NOTIFY_NOTE_CHARS}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="เช่น ด่วน ขอภายในวันนี้ / รายละเอียดเพิ่มเติมสำหรับผู้อนุมัติ"
          />
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
            {note.length}/{MAX_NOTIFY_NOTE_CHARS}
          </div>
        </div>

        <label className="em-upload" style={{ cursor: "pointer" }}>
          <div className="em-upload-ico" style={{ flexShrink: 0 }}><IconUpload size={18} /></div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>แนบรูปประกอบ (ไม่บังคับ)</span>
            <span style={{ fontSize: 11.5 }}>PNG/JPG · สูงสุด {MAX_NOTIFY_NOTE_IMAGES} รูป · รวมกันไม่เกิน 10 MB</span>
          </div>
          <input
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={handleFilesSelected}
          />
        </label>
        {imageError && <div style={{ fontSize: 11.5, color: "var(--rose)", fontWeight: 600 }}>{imageError}</div>}
        {uploadError && <div style={{ fontSize: 11.5, color: "var(--rose)", fontWeight: 600 }}>{uploadError}</div>}
        {images.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {images.map((file, index) => (
              <AttachItem
                key={`${file.name}-${file.size}-${index}`}
                name={file.name}
                size={formatAttachmentSize(file.size)}
                onRemove={() => removeImage(index)}
              />
            ))}
          </div>
        )}

        <FlagCheckbox
          checked={attachExcel}
          onChange={onAttachExcelChange}
          title="แนบฟอร์ม Excel ของเมโมนี้ไปกับอีเมล"
          sub="แนบไฟล์ F-DC-006 ของเมโมนี้ไปกับอีเมลแจ้งเตือน (Telegram จะไม่ได้รับไฟล์นี้)"
        />
      </div>
    </div>
  );
}
