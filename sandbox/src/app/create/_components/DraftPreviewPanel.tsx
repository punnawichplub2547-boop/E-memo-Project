import { approvalLabels, type ApprovalCategory, type ApprovalLevel, type RequestItem } from "@/lib/approval";
import { IconSparkles, IconRefresh } from "@/components/icons";

const effectiveQty = (qty: number) => (qty > 0 ? qty : 1);

interface DraftPreviewPanelProps {
  subject: string;
  category: ApprovalCategory;
  department: string;
  amount: number;
  description: string;
  effectiveApprover: ApprovalLevel;
  selectedRoute: ApprovalLevel[];
  orderedReadRecipients: string[];
  routeReview: { requiresReason: boolean };
  recommendation: { notifyMD: boolean };
  currentDateLabel: string;
  requestItems: RequestItem[];
  requestItemsGrandTotal: number;
  cleanOverrideReason: string;
  issuerName: string;
  closingRemark: string;
}

export function DraftPreviewPanel({
  subject,
  category,
  department,
  amount,
  description,
  effectiveApprover,
  selectedRoute,
  orderedReadRecipients,
  routeReview,
  recommendation,
  currentDateLabel,
  requestItems,
  requestItemsGrandTotal,
  cleanOverrideReason,
  issuerName,
  closingRemark,
}: DraftPreviewPanelProps) {
  return (
    <div className="em-card">
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><IconSparkles size={15} style={{ color: "var(--primary)" }} /> AI Draft Preview</h3>
          <div className="em-sub">ร่างจดหมายภาษาไทย - แก้ไขได้ก่อนส่ง</div>
        </div>
        <button className="em-btn sm ghost"><IconRefresh size={13} /> Regenerate</button>
      </div>
      <div className="em-card-body" style={{ paddingTop: 6 }}>
        <div style={{ padding: 18, borderRadius: 10, background: "linear-gradient(180deg,#FAFBFF 0%,#FFFFFF 100%)", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.75, color: "var(--ink-2)", fontFamily: '"Noto Sans Thai",Inter,sans-serif' }}>
          <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 12, color: "var(--ink)" }}>บันทึกข้อความ</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", marginBottom: 12, fontSize: 12.5 }}>
            <span style={{ color: "var(--muted)" }}>เรื่อง</span><span style={{ fontWeight: 600 }}>{subject}</span>
            <span style={{ color: "var(--muted)" }}>เรียน</span><span style={{ fontWeight: 600 }}>{effectiveApprover}</span>
            <span style={{ color: "var(--muted)" }}>วันที่</span><span>{currentDateLabel}</span>
            <span style={{ color: "var(--muted)" }}>Route</span><span>{selectedRoute.join(" -> ")}</span>
            <span style={{ color: "var(--muted)" }}>จาก</span><span>{department} · {issuerName}</span>
            <span style={{ color: "var(--muted)" }}>Read / Review</span><span>{orderedReadRecipients.join(" -> ") || "—"}</span>
            {routeReview.requiresReason && (<>
              <span style={{ color: "var(--muted)" }}>Exception</span>
              <span style={{ color: "#7C5E0F", fontWeight: 600 }}>{cleanOverrideReason || "ต้องระบุเหตุผลก่อนส่ง"}</span>
            </>)}
            {recommendation.notifyMD && (<>
              <span style={{ color: "var(--muted)" }}>สำเนา</span>
              <span style={{ color: "#7C5E0F", fontWeight: 600 }}>Managing Director (เพื่อทราบ - ปรับราคา)</span>
            </>)}
          </div>
          <hr className="em-divider" style={{ margin: "10px 0 14px" }} />
          <p style={{ marginBottom: 10 }}>ขออนุมัติรายการ {approvalLabels[category]} วงเงิน <strong>฿{amount.toLocaleString()}</strong> เพื่อสนับสนุนการดำเนินงานของแผนก {department}</p>
          <p style={{ marginBottom: 10 }}>{description}</p>
          {requestItems.some(r => r.name.trim()) && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>รายการที่ขออนุมัติ:</div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 10 }}>
                        <tbody>
                          {requestItems.filter(r => r.name.trim()).map((r, i) => {
                            const qty = effectiveQty(r.qty);
                            const lt = Math.round(qty * r.unitPrice);
                            return (
                              <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                <td style={{ padding: "3px 0", color: "var(--ink-2)" }}>{i + 1}. {r.name}</td>
                                <td style={{ textAlign: "center", color: "var(--muted)", width: 80 }}>{qty} {r.unit}</td>
                                <td style={{ textAlign: "right", fontWeight: 600, width: 90 }}>฿{lt.toLocaleString()}</td>
                              </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ padding: "5px 0 2px", fontWeight: 700, fontSize: 12.5 }}>รวมทั้งสิ้น</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)", fontSize: 12.5 }}>฿{requestItemsGrandTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
          {closingRemark.trim() && (
            <>
              <hr className="em-divider" style={{ margin: "10px 0 14px" }} />
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>หมายเหตุ</div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{closingRemark.trim()}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
