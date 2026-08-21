"use client";

import { useState } from "react";
import { IconCheck, IconX } from "@/components/icons";
import { shouldConfirmFormModeSwitch, type MemoFormMode } from "@/lib/memo-body-blocks";

type Props = {
  formMode: MemoFormMode;
  /** Current free-form block count — drives the C3 data-loss confirmation. */
  blockCount: number;
  /** True in edit-and-resubmit mode: the mode is locked from the first submit (Q5). */
  disabled: boolean;
  /** Count of people picked on the custom-route tab. Free-form forces custom
   *  routing, so 0 here means the server will 400 (fix round 1, F2) — the
   *  warning must live here, next to the toggle, not inside the collapsible
   *  assistant panel where CustomRouteCard's own empty-state note lives. */
  customRoutePeopleCount: number;
  /** True when the free-form custom route's final approver ranks below the
   *  Book1 recommendation and no override reason has been given yet — the
   *  reason field itself (CustomRouteReasonNote) lives on the "Approver
   *  Routing" tab inside the same collapsible panel as the F2 case above, so
   *  this needs the same always-visible treatment (fix round 2, G1). */
  needsRouteOverrideReason: boolean;
  /** Expands the assistant panel and switches it to the Approver Routing tab
   *  — lets the G1 warning below tell the user where to go AND take them
   *  there, instead of just naming a tab they still have to go find. */
  onGoToRoutingTab: () => void;
  onChange: (mode: MemoFormMode) => void;
};

/**
 * The /create mode switch (standard purchase/hire form vs. free-form body).
 * Extracted out of page.tsx per the >700-line guardrail (carry-in C5) and
 * because it owns real state of its own (the two-step inline confirm before
 * a mode switch that clears the free-form blocks — carry-in C3).
 */
export function FormModeToggle({
  formMode,
  blockCount,
  disabled,
  customRoutePeopleCount,
  needsRouteOverrideReason,
  onGoToRoutingTab,
  onChange,
}: Props) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handlePick = (mode: MemoFormMode) => {
    if (disabled || mode === formMode) return;
    if (shouldConfirmFormModeSwitch(mode, blockCount)) {
      setConfirmingClear(true);
      return;
    }
    onChange(mode);
  };

  const confirmClear = () => {
    setConfirmingClear(false);
    onChange("standard");
  };

  return (
    <div className="em-form-mode-toggle">
      {/* M9 (UX review): the labels used to describe only the side effect
          ("ระบบแนะนำสายอนุมัติ" / "เลือกผู้อนุมัติเอง"), so the control read as "how do I
          pick approvers" rather than "which form am I filling in". Two lines: the
          mode on top, the consequence underneath — which also fixes H2, because
          the single-line labels were ~560px wide inside a ~358px phone and the
          first one was cut off mid-word with no hint that it scrolled. */}
      <div className="em-eyebrow" style={{ marginBottom: 6 }}>รูปแบบฟอร์ม / Form mode</div>
      <div className="em-tabs em-form-mode-tabs" role="tablist" aria-label="รูปแบบฟอร์ม">
        <button
          type="button"
          role="tab"
          aria-selected={formMode === "standard"}
          className={`em-tab em-form-mode-tab ${formMode === "standard" ? "active" : ""}`}
          disabled={disabled}
          title={disabled ? "รูปแบบฟอร์มถูกล็อกไว้ตั้งแต่ส่งครั้งแรก" : undefined}
          onClick={() => handlePick("standard")}
        >
          <span className="em-form-mode-tab-name">ฟอร์มซื้อ/จ้าง</span>
          <span className="em-form-mode-tab-sub">ฟอร์มมาตรฐาน · ระบบแนะนำสายอนุมัติ</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={formMode === "freeform"}
          className={`em-tab em-form-mode-tab ${formMode === "freeform" ? "active" : ""}`}
          disabled={disabled}
          title={disabled ? "รูปแบบฟอร์มถูกล็อกไว้ตั้งแต่ส่งครั้งแรก" : undefined}
          onClick={() => handlePick("freeform")}
        >
          <span className="em-form-mode-tab-name">ฟอร์มอิสระ</span>
          <span className="em-form-mode-tab-sub">เขียนเนื้อหาเอง · เลือกผู้อนุมัติเอง</span>
        </button>
      </div>
      {/* L1 (UX review): the confirmation used to REPLACE the tablist, so while it
          was open the requester could not see which mode they were in. It sits
          under the tabs now instead. */}
      {confirmingClear && (
        <div className="em-form-mode-confirm" role="alert">
          <span className="em-form-mode-confirm-text">
            สลับกลับฟอร์มซื้อ/จ้างจะล้างเนื้อหาที่พิมพ์ไว้ในฟอร์มอิสระทั้งหมด ยืนยันหรือไม่?
          </span>
          <button
            type="button"
            className="em-btn sm"
            aria-label="ยืนยันล้างบล็อกและสลับไปฟอร์มซื้อ/จ้าง"
            onClick={confirmClear}
          >
            <IconCheck size={12} /> ยืนยัน
          </button>
          <button
            type="button"
            className="em-btn sm ghost"
            aria-label="ยกเลิกการสลับฟอร์ม"
            onClick={() => setConfirmingClear(false)}
          >
            <IconX size={12} /> ยกเลิก
          </button>
        </div>
      )}
      {disabled && (
        <div className="em-form-mode-lock-note">รูปแบบฟอร์มถูกล็อกไว้ตั้งแต่ส่งครั้งแรก</div>
      )}
      {/* C1 (UX review): these two conditions BLOCK submission, so they get the
          warning voice (.em-hint-warn) and role="alert". Only the "mode is locked"
          line above stays .em-form-mode-lock-note — that one is genuinely info.
          Before this, a message that stopped the requester from finishing their
          work was rendered in the smallest, faintest text on the page. */}
      {formMode === "freeform" && customRoutePeopleCount === 0 && (
        <div className="em-hint-warn em-form-mode-block-note" role="alert">
          ฟอร์มอิสระต้องเลือกผู้อนุมัติเองอย่างน้อย 1 คน — บันทึกร่างหรือส่งขออนุมัติไม่ได้จนกว่าจะเลือก
        </div>
      )}
      {formMode === "freeform" && needsRouteOverrideReason && (
        <div className="em-hint-warn em-form-mode-block-note" role="alert">
          <span>
            ผู้อนุมัติที่เลือกต่ำกว่าที่ Book1 แนะนำ — ต้องกรอกเหตุผลก่อนจึงจะส่งขออนุมัติได้
          </span>
          <button type="button" className="em-btn sm" onClick={onGoToRoutingTab}>
            ไปกรอกเหตุผลที่แท็บ &quot;เส้นทางอนุมัติ&quot;
          </button>
        </div>
      )}
    </div>
  );
}
