"use client";

import React, { useState } from "react";

function MailIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={2} y={4} width={20} height={16} rx={2} />
      <path d="m2 6 10 7 10-7" />
    </svg>
  );
}

// Popover button in the queue drawer: email this memo as an .xlsx attachment
// (same F-DC-006 layout as the download) to free-typed recipient(s).
export function EmailExcelButton({ memoId }: { memoId: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSend() {
    if (!to.trim() || status === "sending") return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch(`/api/memos/${encodeURIComponent(memoId)}/email-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: string[] };
      if (!res.ok) {
        setStatus("error");
        setMessage(
          res.status === 503 ? "ระบบ email ยังไม่ได้ตั้งค่า"
          : res.status === 400 ? "อีเมลผู้รับไม่ถูกต้อง"
          : data.error ?? "ส่งไม่สำเร็จ",
        );
        return;
      }
      setStatus("sent");
      setMessage(`ส่งสำเร็จ ${data.sent?.length ?? 0} ฉบับ`);
      setTo("");
    } catch {
      setStatus("error");
      setMessage("ส่งไม่สำเร็จ");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="em-btn sm ghost icon-only"
        onClick={() => setOpen((v) => !v)}
        title="ส่ง Excel ทาง email"
        aria-label="ส่ง Excel ทาง email"
      >
        <MailIcon />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, width: 280,
            padding: 12, borderRadius: 10, background: "var(--surface, #fff)",
            border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ส่งเมโม (Excel) ทาง email</div>
          <input
            type="text"
            value={to}
            onChange={(e) => { setTo(e.target.value); setStatus("idle"); setMessage(""); }}
            placeholder="email ผู้รับ (หลายคนคั่นด้วย ,)"
            style={{
              width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 6,
              border: "1px solid rgba(0,0,0,0.18)", marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="em-btn sm"
              onClick={handleSend}
              disabled={status === "sending" || !to.trim()}
            >
              {status === "sending" ? "กำลังส่ง..." : "ส่ง"}
            </button>
            {message && (
              <span style={{ fontSize: 11, color: status === "error" ? "#b91c1c" : "#047857" }}>
                {message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
