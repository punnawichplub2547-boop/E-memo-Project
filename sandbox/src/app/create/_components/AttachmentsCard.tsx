import { IconPaperclip, IconUpload } from "@/components/icons";
import { AttachItem } from "./AttachItem";

export function AttachmentsCard() {
  return (
    <div className="em-card">
      <div className="em-card-head" style={{ padding: "14px 18px" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <IconPaperclip size={14} />
            </span>
            เอกสารแนบ / Attachments
          </h3>
          <div className="em-sub" style={{ marginTop: 2 }}>
            <span style={{ fontSize: 10, color: "var(--amber)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Prototype · ไม่บันทึกจริง</span>
          </div>
        </div>
      </div>
      <div className="em-card-body" style={{ padding: "10px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="em-upload">
          <div className="em-upload-ico"><IconUpload size={18} /></div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</span>
            <span style={{ fontSize: 11.5 }}>PDF, DOCX, XLSX, JPG · สูงสุด 25 MB</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <AttachItem name="ใบเสนอราคา-3-บริษัท.pdf" size="412 KB" />
          <AttachItem name="รายการอุปกรณ์-Q2-2026.xlsx" size="86 KB" />
        </div>
      </div>
    </div>
  );
}
