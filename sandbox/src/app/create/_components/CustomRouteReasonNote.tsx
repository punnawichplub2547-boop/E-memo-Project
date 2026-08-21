import { IconShield } from "@/components/icons";
import type { ApprovalLevel } from "@/lib/approval";
import { approvalTierClass } from "@/lib/approval-tier-class";

type Props = {
  recommendedFinalApprover: ApprovalLevel;
  recommendationReason: string;
  requiresReason: boolean;
  routeOverrideReason: string;
  onRouteOverrideReasonChange: (v: string) => void;
};

/**
 * Free-form mode's Book1 comparison — shown ALONGSIDE `CustomRouteCard`, not
 * instead of it (Ruling 14 / Task 10 fix round 1, F1). `RoutingCard` is not
 * reused here on purpose: its approver-select dropdown and skip-GM checkbox
 * pick a Book1 *level*, which has no effect on a custom route's real approver
 * (the last person in `CustomRouteCard`'s list) and would be a second,
 * disconnected control sitting next to the one that actually matters —
 * exactly the kind of duplicate the fix asked not to create.
 */
export function CustomRouteReasonNote({
  recommendedFinalApprover,
  recommendationReason,
  requiresReason,
  routeOverrideReason,
  onRouteOverrideReasonChange,
}: Props) {
  return (
    <div className="em-card">
      <div className="em-card-head">
        <div>
          <h3>เทียบกับข้อเสนอแนะ Book1</h3>
          {/* C1 (UX review): when a reason is required this card is the one
              mandatory gate of the whole feature — it must not describe itself
              as reference-only while holding a required field. */}
          <div className="em-sub">
            {requiresReason
              ? "ต้องกรอกเหตุผลข้างล่างก่อนจึงส่งขออนุมัติได้ — สายที่เลือกเองต่ำกว่าที่ Book1 แนะนำ"
              : "ใช้เป็นข้อมูลอ้างอิง — ไม่ผูกกับสายที่เลือกเอง (Customize route เอง) ด้านล่าง"}
          </div>
        </div>
        {/* Derived, not hardcoded: this badge names the Book1 recommendation, and this
            card exists to make the gap between that tier and the picked route visible —
            printing "Managing Director" in the Manager colour hid exactly that. */}
        <span className={`em-tier ${approvalTierClass(recommendedFinalApprover)}`}>
          {recommendedFinalApprover}
        </span>
      </div>
      <div className="em-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <IconShield size={12} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="em-eyebrow" style={{ marginBottom: 3 }}>เหตุผลจากกฎ</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{recommendationReason}</div>
          </div>
        </div>

        {requiresReason && (
          <div className="em-field">
            <label className="em-label">
              เหตุผลที่เลือกผู้อนุมัติต่ำกว่าที่ Book1 แนะนำ <span className="req">*</span>
            </label>
            <textarea
              className="em-textarea"
              aria-invalid={routeOverrideReason.trim() === "" ? true : undefined}
              style={{
                minHeight: 72,
                ...(routeOverrideReason.trim() === ""
                  ? { borderColor: "var(--rose)" }
                  : null),
              }}
              placeholder="ระบุเหตุผล เช่น คุยกับผู้อนุมัติแล้ว / เรื่องเร่งด่วน"
              value={routeOverrideReason}
              onChange={(e) => onRouteOverrideReasonChange(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
