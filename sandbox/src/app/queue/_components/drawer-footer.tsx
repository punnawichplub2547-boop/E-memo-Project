"use client";

import React, { useState } from "react";
import type { MemoRecord } from "@/lib/approval";
import { IconCheck, IconReturn, IconX } from "@/components/icons";

export function DrawerFooter({
  memo,
  onAction,
  onReturn,
  onResubmit,
  onSkipAllReads,
}: {
  memo: MemoRecord;
  onAction: (id: string, action: "approve" | "reject") => void;
  onReturn: (id: string, reason: string) => void;
  onResubmit: (id: string, revisionNote?: string) => void;
  onSkipAllReads: (id: string, reason: string) => void;
}) {
  // key={selectedMemo.id} on the parent DrawerPanel guarantees full remount on memo
  // selection change, so simple boolean states are safe here.
  const [returnMode, setReturnMode] = useState(false);
  const [localReturnReason, setLocalReturnReason] = useState("");
  const [resubmitMode, setResubmitMode] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [skipReadsMode, setSkipReadsMode] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  const hasPendingReads = memo.readActions?.some(ra => ra.status === "pending") ?? false;

  return (
    <div className="em-drawer-foot">
      {memo.status === "pending" ? (
        returnMode ? (
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
                disabled={!localReturnReason.trim()}
                onClick={() => onReturn(memo.id, localReturnReason.trim())}
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
                disabled={!skipReason.trim()}
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
                  onClick={() => { setSkipReadsMode(true); setSkipReason(""); }}
                >
                  ข้ามขั้นตอนรับทราบ
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="em-btn danger"
                style={{ flex: 1 }}
                onClick={() => onAction(memo.id, "reject")}
              >
                <IconX size={14} /> Reject
              </button>
              <button className="em-btn" style={{ flex: 1 }} onClick={() => { setReturnMode(true); setLocalReturnReason(""); }}>
                <IconReturn size={14} /> Return
              </button>
              <button
                className="em-btn primary"
                style={{ flex: 2 }}
                disabled={hasPendingReads}
                onClick={() => onAction(memo.id, "approve")}
              >
                <IconCheck size={14} /> {hasPendingReads ? "Approve (รอรับทราบ)" : "Approve"}
              </button>
            </div>
          </div>
        )
      ) : memo.status === "returned" ? (
        resubmitMode ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55, padding: "7px 10px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              This prototype resubmits the existing memo content with an optional correction note. Full edit/resubmit form is deferred.
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
                onClick={() => onResubmit(memo.id, revisionNote.trim() || undefined)}
              >
                <IconReturn size={13} /> Confirm Resubmit
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="em-btn"
            style={{ flex: 1, borderColor: "rgba(180,83,9,0.35)", color: "var(--amber)" }}
            onClick={() => { setResubmitMode(true); setRevisionNote(""); }}
          >
            <IconReturn size={14} /> ส่งตรวจใหม่ (ยังไม่แก้ฟอร์ม)
          </button>
        )
      ) : (
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          This memo has been <strong>{memo.status}</strong>
        </div>
      )}
    </div>
  );
}
