import { type ApprovalCategory, type BudgetStatus, approvalLabels } from "@/lib/approval";
import {
  clampNonNegativeInputElement,
  coerceNonNegativeNumber,
  shouldBlockNonNegativeNumberKey,
} from "@/lib/number-input";
import { IconSparkles, IconTag, IconBuilding } from "@/components/icons";
import { FlagCheckbox } from "./FlagCheckbox";

interface MemoDetailsCardProps {
  subject: string;
  category: ApprovalCategory;
  department: string;
  amount: number;
  budgetStatus: BudgetStatus;
  clockTimeLabel: string;
  clockDateLabel: string;
  issuer: { name: string; department: string; role: string };
  isAiLoading: boolean;

  followsProductionPlan: boolean;
  isDeadStockOrSlowMovement: boolean;
  isPriceAdjustment: boolean;
  priceAdjustmentReason: string;
  deptMonthlyOverBudgetTotal: number;

  supportsPriceAdjustment: boolean;
  supportsProductionPlan: boolean;
  supportsDeadStock: boolean;
  showDeptMonthly: boolean;
  effectiveIsPriceAdjustment: boolean;

  onSubjectChange: (v: string) => void;
  onCategoryChange: (v: ApprovalCategory) => void;
  onDepartmentChange: (v: string) => void;
  onAmountChange: (v: number) => void;
  onBudgetStatusChange: (v: BudgetStatus) => void;
  onFollowsProductionPlanChange: (v: boolean) => void;
  onIsDeadStockChange: (v: boolean) => void;
  onIsPriceAdjustmentChange: (v: boolean) => void;
  onPriceAdjustmentReasonChange: (v: string) => void;
  onDeptMonthlyChange: (v: number) => void;
  onAiSuggest: () => void;
}

export function MemoDetailsCard({
  subject,
  category,
  department,
  amount,
  budgetStatus,
  clockTimeLabel,
  clockDateLabel,
  issuer,
  isAiLoading,
  followsProductionPlan,
  isDeadStockOrSlowMovement,
  isPriceAdjustment,
  priceAdjustmentReason,
  deptMonthlyOverBudgetTotal,
  supportsPriceAdjustment,
  supportsProductionPlan,
  supportsDeadStock,
  showDeptMonthly,
  effectiveIsPriceAdjustment,
  onSubjectChange,
  onCategoryChange,
  onDepartmentChange,
  onAmountChange,
  onBudgetStatusChange,
  onFollowsProductionPlanChange,
  onIsDeadStockChange,
  onIsPriceAdjustmentChange,
  onPriceAdjustmentReasonChange,
  onDeptMonthlyChange,
  onAiSuggest,
}: MemoDetailsCardProps) {
  return (
    <div className="em-card">
      <div className="em-card-head">
        <div>
          <h3>รายละเอียด Memo</h3>
          <div className="em-sub">กรอกข้อมูล - ระบบจะแนะนำผู้อนุมัติตาม Approval Matrix (Book1)</div>
        </div>
        <button
          type="button"
          className="em-btn sm"
          onClick={onAiSuggest}
          disabled={isAiLoading}
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          <IconSparkles size={11} />
          {isAiLoading ? "กำลังสร้าง..." : "AI Suggest"}
        </button>
      </div>
      <div className="em-card-body em-form-grid">

        <div className="em-field">
          <label className="em-label">เรื่อง <span className="req">*</span></label>
          <input className="em-input" value={subject} onChange={e => onSubjectChange(e.target.value)} />
        </div>

        {/* Document Info — Memo identity + Live clock */}
        <div style={{ display: "flex", gap: 12, alignItems: "stretch", padding: "12px 14px", borderRadius: 10, background: "linear-gradient(to right, var(--surface-soft), var(--surface-2))", border: "1px solid var(--primary-soft)" }}>
          <div style={{ flex: 1, display: "flex", gap: 18 }}>
            <div>
              <div className="em-eyebrow" style={{ marginBottom: 3 }}>เลขที่เอกสาร</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>Draft / Auto-assigned</div>
            </div>
            <div style={{ width: 1, background: "var(--line-2)", flexShrink: 0 }} />
            <div>
              <div className="em-eyebrow" style={{ marginBottom: 3 }}>ผู้จัดทำ / Issued by</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{issuer.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{issuer.department} · {issuer.role}</div>
            </div>
          </div>
          {/* Live clock pill */}
          <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(37,99,235,0.06)", border: "1px solid var(--primary-soft)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
              <span className="pulse-dot" style={{ background: "var(--primary)" }} /> Live
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1 }}>
              {clockTimeLabel}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.5, marginTop: 2 }}>
              {clockDateLabel}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500, letterSpacing: "0.04em" }}>Thailand · GMT+7</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="em-field">
            <label className="em-label">หมวดรายการ <span className="req">*</span></label>
            <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
              <IconTag size={14} style={{ color: "var(--muted)" }} />
              <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                value={category} onChange={e => onCategoryChange(e.target.value as ApprovalCategory)}>
                {Object.entries(approvalLabels).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
            </div>
          </div>
          <div className="em-field">
            <label className="em-label">แผนก <span className="req">*</span></label>
            <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
              <IconBuilding size={14} style={{ color: "var(--muted)" }} />
              <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
                value={department} onChange={e => onDepartmentChange(e.target.value)}>
                <option>HR&amp;GA</option><option>Production</option><option>IT</option>
                <option>Engineering</option><option>GA</option><option>Maintenance</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="em-field">
            <label className="em-label">จำนวนเงิน (THB) <span className="req">*</span></label>
            <div className="em-input-prefix">
              <span className="pre">฿</span>
              <input
                type="number"
                min={0}
                value={amount}
                onInput={(e) => clampNonNegativeInputElement(e.currentTarget)}
                onBlur={(e) => clampNonNegativeInputElement(e.currentTarget)}
                onKeyDown={(e) => {
                  if (shouldBlockNonNegativeNumberKey(e.key)) e.preventDefault();
                }}
                onChange={e => onAmountChange(coerceNonNegativeNumber(e.target.value))}
              />
              <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 600 }}>THB</span>
            </div>
            <div className="em-help">เกณฑ์ขึ้นกับหมวด - ดูแผงด้านขวาว่าเข้ากฎข้อใด</div>
          </div>
          <div className="em-field">
            <label className="em-label">สถานะงบประมาณ <span className="req">*</span></label>
            <div className="em-radio-row">
              {(["in-budget", "over-budget", "no-budget"] as BudgetStatus[]).map(s => (
                <label key={s} className={`em-radio${budgetStatus === s ? " active" : ""}`} onClick={() => onBudgetStatusChange(s)}>
                  <span className="em-radio-mark" />
                  {s === "in-budget" ? "ในงบ" : s === "over-budget" ? "เกินงบ" : "ไม่มีงบ"}
                </label>
              ))}
            </div>
          </div>
        </div>

        {(supportsPriceAdjustment || supportsProductionPlan || supportsDeadStock || showDeptMonthly) && (
          <div className="em-field">
            <label className="em-label">เงื่อนไขเพิ่มเติม (Book1)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {supportsProductionPlan && (
                <FlagCheckbox checked={followsProductionPlan} onChange={onFollowsProductionPlanChange}
                  title="ซื้อตามแผนการผลิต (Book1 ข้อ 1.1)" sub="ระบบจะแนะนำ GM โดยไม่ดูจำนวนเงิน" />
              )}
              {supportsDeadStock && (
                <FlagCheckbox checked={isDeadStockOrSlowMovement} onChange={onIsDeadStockChange}
                  title="Dead stock / Slow movement < KPI" sub="แสดงเป็นแท็กให้ผู้อนุมัติทราบ - ไม่กำหนด flow อัตโนมัติ" />
              )}
              {supportsPriceAdjustment && (
                <FlagCheckbox checked={isPriceAdjustment} onChange={onIsPriceAdjustmentChange}
                  title="Supplier ปรับราคา (Book1 หมวด 1/2)" sub="ระบบจะแจ้ง MD ให้รับทราบ - flow อนุมัติยังตามวงเงิน" />
              )}
              {effectiveIsPriceAdjustment && (
                <div className="em-field" style={{ gap: 4, paddingLeft: 8 }}>
                  <label className="em-label" style={{ fontSize: 11.5 }}>เหตุผลการปรับราคา (ถ้ามี)</label>
                  <textarea
                    className="em-textarea"
                    style={{ minHeight: 52 }}
                    placeholder="ระบุสาเหตุที่ Supplier ปรับราคา เช่น ต้นทุนวัตถุดิบสูงขึ้น, อัตราแลกเปลี่ยน"
                    value={priceAdjustmentReason}
                    onChange={e => onPriceAdjustmentReasonChange(e.target.value)}
                  />
                </div>
              )}
              {showDeptMonthly && (
                <div className="em-field" style={{ gap: 4 }}>
                  <label className="em-label" style={{ fontSize: 11.5 }}>ยอด over-budget สะสมของแผนกในเดือนนี้ (บาท)</label>
                  <div className="em-input-prefix">
                    <span className="pre">฿</span>
                    <input type="number" min={0} value={deptMonthlyOverBudgetTotal}
                      onInput={(e) => clampNonNegativeInputElement(e.currentTarget)}
                      onBlur={(e) => clampNonNegativeInputElement(e.currentTarget)}
                      onKeyDown={(e) => {
                        if (shouldBlockNonNegativeNumberKey(e.key)) e.preventDefault();
                      }}
                      onChange={e => onDeptMonthlyChange(coerceNonNegativeNumber(e.target.value))} />
                    <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 600 }}>THB</span>
                  </div>
                  <div className="em-help">โควต้า 10,000/แผนก/เดือน - เกินแล้วจะแนะนำ MD</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
