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
  onChange: (mode: MemoFormMode) => void;
};

/**
 * The /create mode switch (standard purchase/hire form vs. free-form body).
 * Extracted out of page.tsx per the >700-line guardrail (carry-in C5) and
 * because it owns real state of its own (the two-step inline confirm before
 * a mode switch that clears the free-form blocks — carry-in C3).
 */
export function FormModeToggle({ formMode, blockCount, disabled, customRoutePeopleCount, onChange }: Props) {
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
      {confirmingClear ? (
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
      ) : (
        <div className="em-tabs em-form-mode-tabs" role="tablist" aria-label="รูปแบบฟอร์ม">
          <button
            type="button"
            role="tab"
            aria-selected={formMode === "standard"}
            className={`em-tab ${formMode === "standard" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => handlePick("standard")}
          >
            ฟอร์มซื้อ/จ้าง — ระบบแนะนำสายอนุมัติ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={formMode === "freeform"}
            className={`em-tab ${formMode === "freeform" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => handlePick("freeform")}
          >
            ฟอร์มอิสระ — เลือกผู้อนุมัติเอง
          </button>
        </div>
      )}
      {disabled && (
        <div className="em-form-mode-lock-note">รูปแบบฟอร์มถูกล็อกไว้ตั้งแต่ส่งครั้งแรก</div>
      )}
      {formMode === "freeform" && customRoutePeopleCount === 0 && (
        <div className="em-form-mode-lock-note">
          ฟอร์มอิสระต้องเลือกผู้อนุมัติเองอย่างน้อย 1 คน — บันทึกร่างหรือส่งขออนุมัติไม่ได้จนกว่าจะเลือก
        </div>
      )}
    </div>
  );
}
