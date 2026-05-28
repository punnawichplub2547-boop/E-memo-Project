import { type ApprovalLevel, approvalLevels } from "@/lib/approval";
import { IconSparkles, IconUsers, IconCrown, IconBell, IconShield, IconRefresh } from "@/components/icons";
import { FlagCheckbox } from "./FlagCheckbox";
import { MiniStep } from "./MiniStep";

interface RoutingCardProps {
  effectiveApprover: ApprovalLevel;
  tierClass: string;
  isOverridden: boolean;
  effectiveIsDeadStock: boolean;
  skipGmStep: boolean;
  routeOverrideReason: string;
  flow: ApprovalLevel[];
  routeReview: {
    mode: "recommended" | "escalated" | "exception";
    reasonLabel: string;
    requiresReason: boolean;
  };
  recommendation: {
    reason: string;
    notifyMD: boolean;
    notifyMDReason?: string;
    recommendedFinalApprover: ApprovalLevel;
  };
  onApproverChange: (v: ApprovalLevel) => void;
  onReset: () => void;
  onSkipGmChange: (v: boolean) => void;
  onRouteOverrideReasonChange: (v: string) => void;
}

export function RoutingCard({
  effectiveApprover,
  tierClass,
  isOverridden,
  effectiveIsDeadStock,
  skipGmStep,
  routeOverrideReason,
  flow,
  routeReview,
  recommendation,
  onApproverChange,
  onReset,
  onSkipGmChange,
  onRouteOverrideReasonChange,
}: RoutingCardProps) {
  return (
    <div className="em-card" style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(70% 80% at 100% 0%,rgba(59,130,246,0.10),transparent 60%)" }} />
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><IconSparkles size={15} style={{ color: "var(--primary)" }} /> Approver Routing</h3>
          <div className="em-sub">ระบบแนะนำตาม Book1 - เลือกเองได้อิสระ</div>
        </div>
        <span className="em-tier mgr">{isOverridden ? "Overridden" : "Auto"}</span>
      </div>
      <div className="em-card-body" style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>

        <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--primary-grad-soft)", border: "1px solid var(--primary-soft)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-grad)", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 6px 14px rgba(37,99,235,0.30)", flexShrink: 0 }}>
            {effectiveApprover === "Managing Director" ? <IconCrown size={20} /> : <IconUsers size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <div className="em-eyebrow" style={{ color: "var(--primary)" }}>Tier · {tierClass.toUpperCase()}</div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>{effectiveApprover}</div>
          </div>
        </div>

        <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><IconShield size={12} /></div>
          <div style={{ flex: 1 }}>
            <div className="em-eyebrow" style={{ marginBottom: 3 }}>เหตุผลจากกฎ</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{recommendation.reason}</div>
          </div>
        </div>

        {recommendation.notifyMD && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--gold-soft)", border: "1px solid rgba(201,168,76,0.40)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(201,168,76,0.25)", color: "#7C5E0F", display: "grid", placeItems: "center", flexShrink: 0 }}><IconBell size={12} /></div>
            <div style={{ flex: 1 }}>
              <div className="em-eyebrow" style={{ marginBottom: 3, color: "#7C5E0F" }}>แจ้ง MD เพื่อทราบ</div>
              <div style={{ fontSize: 12.5, color: "#5C4708", lineHeight: 1.5 }}>{recommendation.notifyMDReason}</div>
            </div>
          </div>
        )}

        {effectiveIsDeadStock && (
          <div style={{ display: "flex", gap: 6 }}>
            <span className="em-tier" style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "rgba(180,83,9,0.30)" }}>Dead stock / Slow movement</span>
          </div>
        )}

        <div className="em-field" style={{ gap: 4 }}>
          <label className="em-label" style={{ fontSize: 11.5 }}>เลือกผู้อนุมัติสุดท้าย (override ได้)</label>
          <div className="em-input-prefix" style={{ paddingLeft: 12 }}>
            <IconUsers size={14} style={{ color: "var(--muted)" }} />
            <select style={{ border: 0, padding: 0, height: 32, background: "transparent", flex: 1, outline: "none", fontSize: 13 }}
              value={effectiveApprover}
              onChange={e => onApproverChange(e.target.value as ApprovalLevel)}>
              {approvalLevels.map((lv) => (
                <option key={lv} value={lv}>{lv}{lv === recommendation.recommendedFinalApprover ? " (แนะนำ)" : ""}</option>
              ))}
            </select>
            {isOverridden && (
              <button type="button" className="em-btn sm ghost" onClick={onReset}
                title="คืนค่าตามที่ระบบแนะนำ" style={{ height: 26, padding: "0 8px" }}>
                <IconRefresh size={11} /> Reset
              </button>
            )}
          </div>
          <div className="em-help">Manager ของแผนกต้องผ่านเสมอ - เลือกได้ว่าจะส่งต่อ GM/MD หรือไม่</div>
        </div>

        {effectiveApprover === "Managing Director" && (
          <FlagCheckbox
            checked={skipGmStep}
            onChange={onSkipGmChange}
            title="Skip GM step / ข้าม GM"
            sub="ใช้เมื่อมีการคุยกันในชีวิตจริงแล้ว หรือ MD ขอให้ส่งตรง - ระบบจะบังคับใส่เหตุผล"
          />
        )}

        <div style={{ padding: "10px 12px", borderRadius: 8, background: routeReview.mode === "exception" ? "var(--amber-soft)" : "var(--surface-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className="em-eyebrow">Route status</span>
            <span className={`em-tier ${routeReview.mode === "exception" ? "" : routeReview.mode === "escalated" ? "md" : "mgr"}`}>{routeReview.mode}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{routeReview.reasonLabel}</div>
        </div>

        {routeReview.requiresReason && (
          <div className="em-field">
            <label className="em-label">Exception reason <span className="req">*</span></label>
            <textarea
              className="em-textarea"
              style={{ minHeight: 72 }}
              placeholder="ระบุเหตุผล เช่น คุยกับ GM แล้ว / เรื่องเร่งด่วน / MD ขอให้ส่งตรง"
              value={routeOverrideReason}
              onChange={e => onRouteOverrideReasonChange(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {flow.map((step, idx) => (
            <MiniStep key={step} title={step} current={step === effectiveApprover} firstMandatory={idx === 0}
              sub={idx === 0 ? "บังคับเสมอ - ผู้จัดการแผนกตรวจสอบ"
                : step === effectiveApprover ? "ผู้อนุมัติสุดท้ายที่เลือก" : "ผ่านเพื่อ review ก่อนส่งต่อ"} />
          ))}
        </div>
      </div>
    </div>
  );
}
