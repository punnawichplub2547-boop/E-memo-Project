"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { MemoRecord } from "@/lib/approval";
import { IconCheck, IconPen, IconReturn, IconX } from "@/components/icons";
import { describeCustomStepShort, isCustomRoute } from "@/lib/custom-route";
import { mdReviewGateStep } from "@/lib/workflow-rules";
import {
  canApproveMemo,
  canRejectMemo,
  canResubmitMemo,
  canReturnOrRejectMemo,
  canReviewMdMemo,
  type PrototypeUser,
} from "@/lib/prototype-users";

export function DrawerFooter({
  memo,
  currentUser,
  onAction,
  onReject,
  onReturn,
  onResubmit,
  onSkipAllReads,
  onReview,
}: {
  memo: MemoRecord;
  currentUser: PrototypeUser;
  onAction: (id: string, action: "approve") => void;
  onReject: (id: string, disposition: "close" | "revision-allowed", reason: string) => void;
  onReturn: (id: string, reason: string, returnToStep?: string) => void;
  onResubmit: (id: string, revisionNote?: string) => void;
  onSkipAllReads: (id: string, reason: string) => void;
  onReview: (
    id: string,
    response: "acknowledged_no_objection" | "comment" | "request_revision" | "escalate_to_md_approval",
    comment?: string,
    reason?: string,
  ) => void;
}) {
  const router = useRouter();

  // key={selectedMemo.id} on the parent DrawerPanel guarantees full remount on memo
  // selection change, so simple boolean states are safe here.
  const [rejectMode, setRejectMode] = useState(false);
  const [localRejectReason, setLocalRejectReason] = useState("");
  const [localRejectDisposition, setLocalRejectDisposition] = useState<"close" | "revision-allowed">("close");
  const [returnMode, setReturnMode] = useState(false);
  const [localReturnReason, setLocalReturnReason] = useState("");
  // Selectable return destination. Empty = restart from the first step (default,
  // backward-compatible). Options are computed below and capped by Q1/Q2 rules.
  const [localReturnToStep, setLocalReturnToStep] = useState("");
  const [resubmitMode, setResubmitMode] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [skipReadsMode, setSkipReadsMode] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [reviewCommentMode, setReviewCommentMode] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRevisionMode, setReviewRevisionMode] = useState(false);
  const [reviewRevisionReason, setReviewRevisionReason] = useState("");
  const canReview = canReviewMdMemo(currentUser, memo);

  const hasPendingReads = memo.readActions?.some(ra => ra.status === "pending") ?? false;
  const canApprove = canApproveMemo(currentUser, memo);
  const canWorkflowDecision = canReturnOrRejectMemo(currentUser, memo);
  // Reject is Manager-and-above only (Supervisor can return but not reject, Q3).
  const canReject = canRejectMemo(currentUser, memo);
  const canResubmit = canResubmitMemo(currentUser, memo);
  // Approve button label follows the step: a Supervisor "passes/checks", not
  // "approves" (Q3), and so does every non-final person in a custom route (Q4).
  const approveVerb =
    memo.currentStep === "Supervisor" || isNonFinalCustomStep(memo) ? "ตรวจแล้ว/ผ่าน" : "Approve";

  // Selectable return-destination options: steps in the route from the first up to
  // (and including) the current step — Q2 forbids picking a step ahead of the actor.
  // Q1 caps an md-review memo so it cannot resume past the gate step (gate-bypass
  // guard). The gate step comes from mdReviewGateStep() itself — the same function the
  // server enforces — rather than a second copy of the rule that can drift from it.
  const route = memo.selectedRoute ?? [];
  const currentStepIndex = route.indexOf(memo.currentStep);
  let maxReturnIndex = currentStepIndex >= 0 ? currentStepIndex : route.length - 1;
  if (memo.requiresMdReview) {
    const gateIndex = route.indexOf(mdReviewGateStep(route));
    if (gateIndex >= 0) maxReturnIndex = Math.min(maxReturnIndex, gateIndex);
  }
  const returnStepOptions = route.slice(0, maxReturnIndex + 1);
  const noWorkflowPermissionText = "ไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้";
  const noResubmitPermissionText = "เฉพาะผู้สร้าง memo หรือ Admin เท่านั้นที่ส่งแก้ไขได้";

  // Shared resubmit form — used by both "returned" and "rejected + revision-allowed" paths.
  const resubmitForm = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55, padding: "7px 10px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
        ทางลัดนี้ส่งเนื้อหาเดิมกลับเข้าสู่ขั้นตอนอนุมัติพร้อมหมายเหตุ โดยไม่แก้ไขรายละเอียดเมโม · ถ้าต้องแก้เนื้อหา ให้กด “แก้ไขและส่งใหม่”
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
        หมายเหตุการแก้ไข{" "}
        <span style={{ fontWeight: 400, color: "var(--muted)" }}>(ไม่บังคับ / optional)</span>
      </div>
      <textarea
        className="em-textarea"
        style={{ minHeight: 64 }}
        placeholder="ระบุสิ่งที่แก้ไข เช่น แนบใบเสนอราคาแล้ว, แก้ไขวงเงินแล้ว"
        value={revisionNote}
        onChange={e => setRevisionNote(e.target.value)}
        autoFocus
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="em-btn sm ghost"
          style={{ flex: 1 }}
          onClick={() => setResubmitMode(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="em-btn sm primary"
          style={{ flex: 2 }}
          disabled={!canResubmit}
          title={canResubmit ? "Confirm resubmit" : noResubmitPermissionText}
          onClick={() => onResubmit(memo.id, revisionNote.trim() || undefined)}
        >
          <IconReturn size={13} /> Confirm Resubmit
        </button>
      </div>
    </div>
  );

  // Two-button layout for returned/rejected-revision-allowed memos.
  // Primary: open revision edit form. Secondary: quick resubmit without editing.
  const revisionActions = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        className="em-btn primary"
        style={{ flex: 1 }}
        disabled={!canResubmit}
        title={canResubmit ? "Edit and resubmit" : noResubmitPermissionText}
        onClick={() => router.push(`/create?revise=${memo.id}`)}
      >
        <IconPen size={14} /> แก้ไขและส่งใหม่
      </button>
      <button
        type="button"
        className="em-btn"
        style={{ flex: 1, borderColor: "rgba(180,83,9,0.35)", color: "var(--amber)" }}
        disabled={!canResubmit}
        title={canResubmit ? "Quick resubmit" : noResubmitPermissionText}
        onClick={() => { setResubmitMode(true); setRevisionNote(""); }}
      >
        <IconReturn size={14} /> ส่งตรวจใหม่ (ยังไม่แก้ฟอร์ม)
      </button>
    </div>
  );

  return (
    <div className="em-drawer-foot">
      {memo.mdReviewStatus === "pending" ? (
        reviewCommentMode ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 700 }}>ความเห็นของ MD</div>
            <textarea
              className="em-textarea"
              style={{ minHeight: 64 }}
              placeholder="ระบุความเห็นประกอบ (ไม่บังคับ)"
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="em-btn sm ghost" style={{ flex: 1 }} onClick={() => setReviewCommentMode(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="em-btn sm primary"
                style={{ flex: 2 }}
                disabled={!canReview}
                onClick={() => {
                  onReview(memo.id, "comment", reviewComment.trim() || undefined);
                  setReviewCommentMode(false);
                }}
              >
                ยืนยันความเห็น
              </button>
            </div>
          </div>
        ) : reviewRevisionMode ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 700 }}>
              ระบุสิ่งที่ต้องการให้แก้ไข <span style={{ color: "var(--rose)" }}>*</span>
            </div>
            <textarea
              className="em-textarea"
              style={{ minHeight: 72 }}
              placeholder="เช่น ราคาสูงกว่าตลาด, ขอใบเสนอราคาเพิ่มเติม"
              value={reviewRevisionReason}
              onChange={e => setReviewRevisionReason(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="em-btn sm ghost" style={{ flex: 1 }} onClick={() => setReviewRevisionMode(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="em-btn sm"
                style={{ flex: 2, background: "var(--amber-soft)", color: "var(--amber)", border: "1px solid rgba(180,83,9,0.30)" }}
                disabled={!reviewRevisionReason.trim() || !canReview}
                onClick={() => onReview(memo.id, "request_revision", undefined, reviewRevisionReason.trim())}
              >
                ยืนยันขอแก้ไข
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              padding: "8px 10px", borderRadius: 6, background: "var(--gold-soft)",
              border: "1px solid rgba(201,168,76,0.40)", fontSize: 12, color: "#7C5E0F", fontWeight: 700,
            }}>
              ต้องผ่านการพิจารณาของ MD ก่อนที่ workflow จะดำเนินต่อ
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="em-btn"
                style={{ flex: 1 }}
                disabled={!canReview}
                title={canReview ? "No objection" : noWorkflowPermissionText}
                onClick={() => onReview(memo.id, "acknowledged_no_objection")}
              >
                ไม่มีข้อโต้แย้ง
              </button>
              <button
                type="button"
                className="em-btn"
                style={{ flex: 1 }}
                disabled={!canReview}
                title={canReview ? "Add a comment" : noWorkflowPermissionText}
                onClick={() => { setReviewCommentMode(true); setReviewComment(""); }}
              >
                แสดงความเห็น
              </button>
              <button
                type="button"
                className="em-btn"
                style={{ flex: 1, borderColor: "rgba(180,83,9,0.35)", color: "var(--amber)" }}
                disabled={!canReview}
                title={canReview ? "Request revision" : noWorkflowPermissionText}
                onClick={() => { setReviewRevisionMode(true); setReviewRevisionReason(""); }}
              >
                ขอแก้ไข
              </button>
              {memo.mdReviewResumeStep !== "Managing Director" && (
                <button
                  type="button"
                  className="em-btn primary"
                  style={{ flex: 1 }}
                  disabled={!canReview}
                  title={canReview ? "Escalate — decide now" : noWorkflowPermissionText}
                  onClick={() => onReview(memo.id, "escalate_to_md_approval")}
                >
                  ยกระดับเป็นผู้อนุมัติ
                </button>
              )}
            </div>
          </div>
        )
      ) : memo.status === "pending" ? (
        rejectMode ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--rose)", fontWeight: 700 }}>
              ระบุเหตุผลที่ปฏิเสธ <span style={{ color: "var(--rose)" }}>*</span>
            </div>
            <textarea
              className="em-textarea"
              style={{ minHeight: 72 }}
              placeholder="เช่น ราคาสูงเกินงบ, ไม่ตรงกับแผนงาน, ข้อมูลไม่เพียงพอ"
              value={localRejectReason}
              onChange={e => setLocalRejectReason(e.target.value)}
              autoFocus
            />
            <div style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
              การดำเนินการหลังปฏิเสธ:
            </div>
            <div style={{ display: "flex", gap: 0, borderRadius: 7, overflow: "hidden", border: "1px solid var(--line-2)" }}>
              <button
                type="button"
                style={{
                  flex: 1, padding: "7px 10px", fontSize: 12, cursor: "pointer",
                  fontWeight: localRejectDisposition === "close" ? 700 : 500,
                  background: localRejectDisposition === "close" ? "var(--rose-soft)" : "transparent",
                  color: localRejectDisposition === "close" ? "var(--rose)" : "var(--muted)",
                  border: "none", borderRight: "1px solid var(--line-2)",
                }}
                onClick={() => setLocalRejectDisposition("close")}
              >
                ปิดคำขอ (Close)
              </button>
              <button
                type="button"
                style={{
                  flex: 1, padding: "7px 10px", fontSize: 12, cursor: "pointer",
                  fontWeight: localRejectDisposition === "revision-allowed" ? 700 : 500,
                  background: localRejectDisposition === "revision-allowed" ? "var(--amber-soft)" : "transparent",
                  color: localRejectDisposition === "revision-allowed" ? "var(--amber)" : "var(--muted)",
                  border: "none",
                }}
                onClick={() => setLocalRejectDisposition("revision-allowed")}
              >
                อนุญาตให้แก้ไข
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="em-btn sm ghost"
                style={{ flex: 1 }}
                onClick={() => { setRejectMode(false); setLocalRejectReason(""); setLocalRejectDisposition("close"); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="em-btn sm danger"
                style={{ flex: 2 }}
                disabled={!localRejectReason.trim() || !canWorkflowDecision}
                title={canWorkflowDecision ? "Confirm reject" : noWorkflowPermissionText}
                onClick={() => onReject(memo.id, localRejectDisposition, localRejectReason.trim())}
              >
                <IconX size={13} /> ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        ) : returnMode ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 700 }}>
              ระบุเหตุผลที่ส่งกลับ <span style={{ color: "var(--rose)" }}>*</span>
            </div>
            <textarea
              className="em-textarea"
              style={{ minHeight: 72 }}
              placeholder="เช่น เอกสารไม่ครบ, ราคาเกินวงเงิน, ต้องแนบใบเสนอราคาเพิ่มเติม"
              value={localReturnReason}
              onChange={e => setLocalReturnReason(e.target.value)}
              autoFocus
            />
            {returnStepOptions.length > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
                  ส่งกลับไปที่ขั้น
                  {memo.requiresMdReview && (
                    <span style={{ fontWeight: 400, color: "var(--muted)" }}>
                      {" "}
                      (จำกัดไม่เกิน{isCustomRoute(route) ? "ผู้ตรวจลำดับแรก" : " Manager"} เพราะต้องผ่าน MD)
                    </span>
                  )}
                </div>
                <select
                  className="em-input"
                  style={{ fontSize: 12.5, padding: "6px 8px" }}
                  value={localReturnToStep}
                  onChange={e => setLocalReturnToStep(e.target.value)}
                >
                  {returnStepOptions.map((step, i) => (
                    <option key={step} value={step}>
                      {describeCustomStepShort(step, memo.customRoute)}
                      {i === 0 ? " (เริ่มต้นใหม่ / default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="em-btn sm ghost"
                style={{ flex: 1 }}
                onClick={() => setReturnMode(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="em-btn sm"
                style={{ flex: 2, background: "var(--amber-soft)", color: "var(--amber)", border: "1px solid rgba(180,83,9,0.30)" }}
                disabled={!localReturnReason.trim() || !canWorkflowDecision}
                title={canWorkflowDecision ? "Confirm return" : noWorkflowPermissionText}
                onClick={() => onReturn(memo.id, localReturnReason.trim(), localReturnToStep || undefined)}
              >
                <IconReturn size={13} /> Confirm Return
              </button>
            </div>
          </div>
        ) : skipReadsMode ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 700 }}>
              ระบุเหตุผลที่ข้ามขั้นตอนรับทราบ <span style={{ color: "var(--rose)" }}>*</span>
            </div>
            <textarea
              className="em-textarea"
              style={{ minHeight: 64 }}
              placeholder="เช่น ฉุกเฉิน, ผู้บริหารอนุมัติให้ข้ามได้"
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="em-btn sm ghost"
                style={{ flex: 1 }}
                onClick={() => setSkipReadsMode(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="em-btn sm primary"
                style={{ flex: 2 }}
                disabled={!skipReason.trim() || !canWorkflowDecision}
                title={canWorkflowDecision ? "Skip read recipients" : noWorkflowPermissionText}
                onClick={() => {
                  onSkipAllReads(memo.id, skipReason.trim());
                  setSkipReadsMode(false);
                  setSkipReason("");
                }}
              >
                ยืนยันข้าม
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {hasPendingReads && (
              <div style={{
                padding: "8px 10px",
                borderRadius: 6,
                background: "var(--amber-soft)",
                border: "1px solid rgba(180,83,9,0.22)",
                fontSize: 12,
                color: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>มีผู้รับทราบที่ยังไม่ได้รับทราบ</div>
                  <div style={{ color: "#92400e", marginTop: 2 }}>กรุณา Mark Read หรือ Skip ก่อนอนุมัติ</div>
                </div>
                <button
                  type="button"
                  className="em-btn sm"
                  style={{ flexShrink: 0, fontSize: 11.5, color: "var(--amber)", background: "transparent", border: "1px solid rgba(180,83,9,0.35)" }}
                  disabled={!canWorkflowDecision}
                  title={canWorkflowDecision ? "Skip read recipients" : noWorkflowPermissionText}
                  onClick={() => { setSkipReadsMode(true); setSkipReason(""); }}
                >
                  ข้ามขั้นตอนรับทราบ
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {canReject && (
                <button
                  className="em-btn danger"
                  style={{ flex: 1 }}
                  title="Reject memo"
                  onClick={() => { setRejectMode(true); setLocalRejectReason(""); setLocalRejectDisposition("close"); }}
                >
                  <IconX size={14} /> Reject
                </button>
              )}
              <button
                className="em-btn"
                style={{ flex: 1 }}
                disabled={!canWorkflowDecision}
                title={canWorkflowDecision ? "Return memo" : noWorkflowPermissionText}
                onClick={() => { setReturnMode(true); setLocalReturnReason(""); setLocalReturnToStep(route[0] ?? ""); }}
              >
                <IconReturn size={14} /> Return
              </button>
              <button
                className="em-btn primary"
                style={{ flex: 2 }}
                disabled={hasPendingReads || !canApprove}
                title={canApprove ? "Approve memo" : noWorkflowPermissionText}
                onClick={() => onAction(memo.id, "approve")}
              >
                <IconCheck size={14} /> {hasPendingReads ? `${approveVerb} (รอรับทราบ)` : canApprove ? approveVerb : `${approveVerb} (ไม่มีสิทธิ์)`}
              </button>
            </div>
          </div>
        )
      ) : memo.status === "returned" ? (
        resubmitMode ? resubmitForm : revisionActions
      ) : memo.status === "rejected" && memo.rejectDisposition === "revision-allowed" ? (
        resubmitMode ? resubmitForm : revisionActions
      ) : (
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          This memo has been <strong>{memo.status}</strong>
          {memo.status === "rejected" && (
            <span style={{ marginLeft: 4 }}>(closed)</span>
          )}
        </div>
      )}
    </div>
  );
}

/** True when the memo sits on a custom-route step that is not the last one — i.e.
 *  the actor is a "ตรวจ/เห็นชอบ" checker, not the approver (Q4). Only affects the
 *  button wording; the Reject block itself is gated by canRejectMemo (Q23). */
function isNonFinalCustomStep(memo: MemoRecord): boolean {
  const route = memo.selectedRoute ?? [];
  if (!isCustomRoute(route)) return false;
  const index = route.indexOf(memo.currentStep);
  return index !== -1 && index < route.length - 1;
}
