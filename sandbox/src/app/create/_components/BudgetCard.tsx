import { IconShield } from "@/components/icons";
import { NumberField } from "./NumberField";

interface BudgetCardProps {
  accountCode: string;
  setAccountCode: (v: string) => void;
  readRecipients: string;
  setReadRecipients: (v: string) => void;
  orderedReadRecipients: string[];
  budgetPlan: number;
  setBudgetPlan: (v: number) => void;
  budgetUsed: number;
  setBudgetUsed: (v: number) => void;
  budgetRemaining: number;
}

export function BudgetCard({
  accountCode,
  setAccountCode,
  readRecipients,
  setReadRecipients,
  orderedReadRecipients,
  budgetPlan,
  setBudgetPlan,
  budgetUsed,
  setBudgetUsed,
  budgetRemaining,
}: BudgetCardProps) {
  return (
    <div className="em-card">
      <div className="em-card-head" style={{ padding: "14px 18px" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <IconShield size={14} />
            </span>
            แผนงบประมาณและการใช้จริง
          </h3>
          <div className="em-sub" style={{ marginTop: 2 }}>ข้อมูลจากแบบฟอร์มกระดาษ</div>
        </div>
      </div>
      <div className="em-card-body" style={{ padding: "10px 18px 18px", display: "grid", gap: 12 }}>
        <div className="em-field">
          <label className="em-label">Account Code / รหัสบัญชี</label>
          <input className="em-input" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} />
        </div>
        <div className="em-field">
          <label className="em-label">ผู้รับทราบ</label>
          <textarea
            className="em-textarea"
            style={{ minHeight: 72 }}
            value={readRecipients}
            placeholder="ACC/FIN, QA/QC, Production Manager"
            onChange={(e) => setReadRecipients(e.target.value)}
          />
          <div className="em-help">ผู้รับทราบ / ผู้ตรวจอ่านตามลำดับ · คั่นด้วย comma หรือขึ้นบรรทัดใหม่</div>
          {orderedReadRecipients.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {orderedReadRecipients.map((recipient, index) => (
                <span
                  key={`${recipient}-${index}`}
                  className="em-tier"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                >
                  {index + 1}. {recipient}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
          <NumberField label="งบประมาณแผน" value={budgetPlan} onChange={setBudgetPlan} />
          <NumberField label="งบที่ใช้ไป" value={budgetUsed} onChange={setBudgetUsed} />
          <div className="em-field" style={{ gridColumn: "1 / -1" }}>
            <label className="em-label">งบคงเหลือหลังรายการนี้</label>
            <div className="em-input-prefix" style={{ background: "var(--surface-soft)", borderColor: "var(--primary-soft)" }}>
              <span className="pre">฿</span>
              <input readOnly value={budgetRemaining.toLocaleString()} style={{ fontWeight: 700, color: "var(--ink)" }} />
              <span style={{ color: budgetRemaining < 0 ? "var(--rose)" : "var(--primary)", fontSize: 11.5, fontWeight: 700 }}>
                {budgetRemaining < 0 ? "เกินงบ" : "คงเหลือ"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
