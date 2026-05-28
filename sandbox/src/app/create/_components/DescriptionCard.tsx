import { IconFileText, IconUpload } from "@/components/icons";
import { WritingHint } from "./WritingHint";

interface DescriptionCardProps {
  description: string;
  onDescriptionChange: (v: string) => void;
  aiError: string | null;
  isPdfLoading: boolean;
  onPdfClick: () => void;
}

export function DescriptionCard({
  description,
  onDescriptionChange,
  aiError,
  isPdfLoading,
  onPdfClick,
}: DescriptionCardProps) {
  return (
    <div className="em-card" style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(60% 80% at 0% 0%, rgba(37,99,235,0.06), transparent 58%)" }} />
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconFileText size={15} style={{ color: "var(--primary)" }} />
            Description / เหตุผลการขอ
          </h3>
          <div className="em-sub">สรุปเหตุผล ความจำเป็น และรายละเอียดประกอบ Memo</div>
        </div>
      </div>
      <div className="em-card-body" style={{ position: "relative", display: "grid", gap: 12 }}>
        <div className="em-field">
          <label className="em-label">Description / เหตุผลการขอ <span className="req">*</span></label>
          <textarea
            className="em-textarea"
            style={{ minHeight: 160, lineHeight: 1.6, padding: "12px 13px" }}
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
          />
          {aiError && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--rose, #BE123C)", fontWeight: 500 }}>
              {aiError}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          <WritingHint title="Why" text="เหตุผลและความจำเป็น" />
          <WritingHint title="What" text="รายการ / งานที่ต้องทำ" />
          <WritingHint title="Impact" text="ผลกระทบหากไม่ดำเนินการ" />
        </div>
        <div style={{ padding: "9px 12px", borderRadius: 8, background: "linear-gradient(180deg, var(--surface-2), #fff)", border: "1px solid var(--line)", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55 }}>
          ใช้ภาษากระชับพอให้ผู้อนุมัติเข้าใจบริบทในครั้งเดียว · AI Draft Preview จะอัปเดตจากข้อความนี้
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid rgba(37,99,235,0.18)",
          background: "linear-gradient(135deg, rgba(239,246,255,0.88) 0%, rgba(255,255,255,0.94) 58%, rgba(250,241,214,0.42) 100%)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.86) inset, 0 10px 24px -24px rgba(30,58,138,0.42)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary-grad)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 6px 14px -7px rgba(37,99,235,0.70)", flexShrink: 0 }}>
              <IconUpload size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>
                เริ่มจากใบเสนอราคา / Start with quotation
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55 }}>
                อ่าน PDF เพื่อเติมข้อมูลผู้ขาย ราคา ส่วนลด และ VAT ต่อแถวลงใน Price Comparison ด้านล่าง
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
                หากไม่มีไฟล์ PDF สามารถกรอกข้อมูลผู้ขายเองด้านล่างได้
              </div>
            </div>
          </div>
          <button
            type="button"
            className="em-btn sm primary"
            onClick={onPdfClick}
            disabled={isPdfLoading}
            title="อัปโหลดใบเสนอราคา PDF เพื่อดึงข้อมูลอัตโนมัติ"
            style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <IconUpload size={12} />
            {isPdfLoading ? "กำลังอ่าน..." : "อ่าน PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
