import { IconFileText } from "@/components/icons";

interface ClosingRemarkCardProps {
  value: string;
  onChange: (v: string) => void;
}

export function ClosingRemarkCard({ value, onChange }: ClosingRemarkCardProps) {
  return (
    <div className="em-card">
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconFileText size={15} style={{ color: "var(--primary)" }} />
            หมายเหตุ / Closing Remark
          </h3>
          <div className="em-sub">หมายเหตุเพิ่มเติมหรือข้อมูลปิดท้าย Memo (ถ้ามี)</div>
        </div>
      </div>
      <div className="em-card-body">
        <div className="em-field">
          <label className="em-label">หมายเหตุ / Closing Remark</label>
          <textarea
            className="em-textarea"
            style={{ minHeight: 100, lineHeight: 1.6, padding: "12px 13px" }}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="ระบุหมายเหตุหรือข้อมูลเพิ่มเติม (ไม่บังคับ)"
          />
        </div>
      </div>
    </div>
  );
}
