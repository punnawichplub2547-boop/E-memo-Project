"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

function roleBadgeLabel(role: string): string {
  const map: Record<string, string> = {
    "admin":                  "Admin",
    "managing-director":      "Managing Director",
    "senior-general-manager": "Sr. General Manager",
    "general-manager":        "General Manager",
    "manager":                "Manager",
    "requester":              "Requester",
    "read-recipient":         "Read Recipient",
  };
  return map[role] ?? role;
}

const ROLE_COLORS: Record<string, { bg: string; color: string; glow: string }> = {
  "admin":                   { bg: "rgba(239,68,68,0.18)",   color: "#EF4444", glow: "rgba(239,68,68,0.35)" },
  "managing-director":       { bg: "rgba(201,168,76,0.2)",   color: "#D4A017", glow: "rgba(201,168,76,0.4)" },
  "senior-general-manager":  { bg: "rgba(139,92,246,0.18)",  color: "#A78BFA", glow: "rgba(139,92,246,0.35)" },
  "general-manager":         { bg: "rgba(59,130,246,0.18)",  color: "#60A5FA", glow: "rgba(59,130,246,0.35)" },
  "manager":                 { bg: "rgba(14,165,233,0.18)",  color: "#38BDF8", glow: "rgba(14,165,233,0.35)" },
  "requester":               { bg: "rgba(148,163,184,0.18)", color: "#94A3B8", glow: "rgba(148,163,184,0.2)" },
  "read-recipient":          { bg: "rgba(148,163,184,0.18)", color: "#94A3B8", glow: "rgba(148,163,184,0.2)" },
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  type TelegramStatus = { linked: false } | { linked: true; username: string | null; linkedAt: string };
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmitReport() {
    const description = reportText.trim();
    if (!description || reportStatus === "sending") return;
    setReportStatus("sending");
    try {
      const res = await fetch("/api/profile/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("request failed");
      setReportText("");
      setReportStatus("sent");
      setReportOpen(false);
    } catch {
      setReportStatus("error");
    }
  }

  useEffect(() => {
    fetch("/api/profile/telegram-account")
      .then(r => r.json())
      .then((d: TelegramStatus) => setTelegramStatus(d))
      .catch(() => setTelegramStatus({ linked: false }));
  }, []);

  async function handleConnectTelegram() {
    const res = await fetch("/api/profile/telegram-link-token", { method: "POST" });
    const data = await res.json() as { deepLink?: string };
    if (data.deepLink) window.open(data.deepLink, "_blank");
  }

  async function handleRevokeTelegram() {
    await fetch("/api/profile/telegram-account", { method: "DELETE" });
    setTelegramStatus({ linked: false });
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "var(--ink-muted)" }}>Loading…</div>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const fields: { label: string; value: string; icon: string }[] = [
    { label: "ชื่อ-นามสกุล",     value: fullName,              icon: "👤" },
    { label: "รหัสบัตรพนักงาน",  value: user.employeeCardId,   icon: "🪪" },
    { label: "อีเมล",             value: user.email,            icon: "✉️" },
    { label: "แผนก",              value: user.department,       icon: "🏢" },
    ...(user.approvalLevel
      ? [{ label: "ระดับอนุมัติ", value: user.approvalLevel,   icon: "✅" }]
      : []),
  ];

  return (
    <>
      <style>{`
        @keyframes pf-streak {
          0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateX(280%) skewX(-18deg); opacity: 0; }
        }
        @keyframes pf-float-a {
          0%,100% { transform: translateY(0px) scale(1); }
          50%     { transform: translateY(-18px) scale(1.04); }
        }
        @keyframes pf-float-b {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-12px); }
        }
        @keyframes pf-avatar-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5), 0 8px 28px rgba(37,99,235,0.4); }
          50%     { box-shadow: 0 0 0 10px rgba(59,130,246,0), 0 8px 36px rgba(37,99,235,0.55); }
        }
        @keyframes pf-ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pf-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pf-dot-blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }
        @keyframes pf-card-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .pf-streak {
          position: absolute; top: 0; bottom: 0; pointer-events: none;
        }
        .pf-streak-1 {
          left: 0; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.1), transparent);
          animation: pf-streak 8s ease-in-out infinite;
        }
        .pf-streak-2 {
          left: 0; width: 22%;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.07), transparent);
          animation: pf-streak 11s ease-in-out infinite;
          animation-delay: -4s;
        }
        .pf-streak-3 {
          left: 0; width: 55%;
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.06), transparent);
          animation: pf-streak 14s ease-in-out infinite;
          animation-delay: -8s;
        }

        .pf-info-row {
          display: flex; align-items: center;
          padding: 14px 22px;
          transition: background 150ms;
        }
        .pf-info-row:hover {
          background: rgba(37,99,235,0.03);
        }
        .pf-logout-btn {
          transition: background 150ms, transform 120ms, box-shadow 150ms;
        }
        .pf-logout-btn:hover {
          background: rgba(239,68,68,0.12) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(239,68,68,0.18);
        }
        .pf-logout-btn:active {
          transform: translateY(0);
        }
        .pf-card-1 { animation: pf-card-in 0.4s 0.05s ease both; }
        .pf-card-2 { animation: pf-card-in 0.4s 0.15s ease both; }
        .pf-card-3 { animation: pf-card-in 0.4s 0.25s ease both; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "var(--bg, #F8FAFC)" }}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(148deg, #060C1F 0%, #0B1735 42%, #102060 100%)",
          padding: "52px 32px 56px",
          position: "relative", overflow: "hidden",
          textAlign: "center",
        }}>
          {/* Traveling light streaks */}
          <div className="pf-streak pf-streak-1" />
          <div className="pf-streak pf-streak-2" />
          <div className="pf-streak pf-streak-3" />

          {/* Dot-grid */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(rgba(147,197,253,0.08) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(180deg, transparent, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.5) 70%, transparent)",
          }} />

          {/* Orb left */}
          <div style={{
            position: "absolute", top: -60, left: -60, width: 260, height: 260,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 70%)",
            animation: "pf-float-a 10s ease-in-out infinite",
          }} />

          {/* Orb right */}
          <div style={{
            position: "absolute", bottom: -40, right: -40, width: 200, height: 200,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
            animation: "pf-float-b 8s ease-in-out infinite", animationDelay: "-3s",
          }} />

          {/* Spinning ring accent behind avatar */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 140, height: 140,
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: "50%", pointerEvents: "none",
            animation: "pf-ring-spin 12s linear infinite",
          }} />
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 168, height: 168,
            border: "1px solid rgba(59,130,246,0.1)",
            borderRadius: "50%", pointerEvents: "none",
            animation: "pf-ring-spin 20s linear infinite reverse",
          }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Avatar */}
            <div style={{
              width: 88, height: 88, borderRadius: "50%",
              background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, fontWeight: 800, color: "#fff",
              animation: "pf-avatar-pulse 2.8s ease-in-out infinite",
              marginBottom: 18,
              position: "relative", zIndex: 2,
            }}>
              {initials}
            </div>

            {/* Name */}
            <div style={{
              fontSize: 22, fontWeight: 800, color: "#EDF4FF",
              letterSpacing: "-0.2px", marginBottom: 10,
              animation: "pf-fade-up 0.45s 0.1s ease both",
            }}>
              {fullName}
            </div>

            {/* Role badges */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 7,
              justifyContent: "center", marginBottom: 20,
              animation: "pf-fade-up 0.45s 0.2s ease both",
            }}>
              {user.roles.map(role => {
                const c = ROLE_COLORS[role] ?? { bg: "rgba(148,163,184,0.18)", color: "#94A3B8", glow: "rgba(148,163,184,0.2)" };
                return (
                  <span key={role} style={{
                    fontSize: 11.5, fontWeight: 700,
                    padding: "3px 11px", borderRadius: 20,
                    background: c.bg, color: c.color,
                    boxShadow: `0 0 10px ${c.glow}`,
                    border: `1px solid ${c.glow}`,
                    letterSpacing: "0.02em",
                  }}>
                    {roleBadgeLabel(role)}
                  </span>
                );
              })}
            </div>

            {/* Status pill */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 13px", borderRadius: 20,
              border: "1px solid rgba(59,130,246,0.22)",
              background: "rgba(37,99,235,0.1)",
              animation: "pf-fade-up 0.45s 0.3s ease both",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#22C55E", boxShadow: "0 0 7px rgba(34,197,94,0.7)",
                animation: "pf-dot-blink 2.5s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 11.5, color: "rgba(147,197,253,0.65)", fontWeight: 500 }}>
                บัญชีใช้งานได้ · {user.department}
              </span>
            </div>
          </div>
        </div>

        {/* ── Info cards ───────────────────────────────────────── */}
        <div style={{ padding: "28px 24px", maxWidth: 560, margin: "0 auto" }}>

          {/* Back button */}
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: 20, textDecoration: "none",
            fontSize: 13, fontWeight: 600, color: "var(--ink-muted, #64748B)",
            transition: "color 150ms",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#2563EB")}
            onMouseLeave={e => (e.currentTarget.style.color = "#64748B")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            กลับหน้าหลัก
          </Link>

          {/* Info table card */}
          <div className="pf-card-1" style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #E2E8F0)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 14,
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          }}>
            <div style={{
              padding: "11px 22px",
              background: "rgba(37,99,235,0.04)",
              borderBottom: "1px solid var(--border, #E2E8F0)",
              fontSize: 11.5, fontWeight: 700, color: "var(--ink-muted, #64748B)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              ข้อมูลบัญชี
            </div>
            {fields.map((f, i) => (
              <div
                key={f.label}
                className="pf-info-row"
                style={{
                  borderBottom: i < fields.length - 1 ? "1px solid var(--border, #E2E8F0)" : "none",
                  gap: 14,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, width: 28, textAlign: "center" }}>{f.icon}</span>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted, #64748B)", width: 130, flexShrink: 0 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 14, color: "var(--ink, #0D1B2A)", fontWeight: 500, wordBreak: "break-all" }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Session card */}
          <div className="pf-card-2" style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #E2E8F0)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 14,
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          }}>
            <div style={{
              padding: "11px 22px",
              background: "rgba(37,99,235,0.04)",
              borderBottom: "1px solid var(--border, #E2E8F0)",
              fontSize: 11.5, fontWeight: 700, color: "var(--ink-muted, #64748B)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              เซสชันปัจจุบัน
            </div>
            <div className="pf-info-row" style={{ gap: 14 }}>
              <span style={{ fontSize: 16, flexShrink: 0, width: 28, textAlign: "center" }}>🔒</span>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted, #64748B)", width: 130, flexShrink: 0 }}>
                สถานะ
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.6)",
                  animation: "pf-dot-blink 2.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "#16A34A" }}>Active — 8h session</span>
              </div>
            </div>
          </div>

          {/* Telegram connection card */}
          <div style={{ marginTop: 24, padding: "16px 20px", background: "var(--surface-raised)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>Telegram</div>
            {telegramStatus === null && <span style={{ color: "var(--ink-muted)", fontSize: 14 }}>กำลังโหลด…</span>}
            {telegramStatus !== null && !telegramStatus.linked && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "var(--ink-muted)", fontSize: 14 }}>ยังไม่ได้เชื่อมต่อ</span>
                <button onClick={handleConnectTelegram} style={{ padding: "6px 14px", borderRadius: 6, background: "#229ED9", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>
                  เชื่อมต่อ Telegram
                </button>
              </div>
            )}
            {telegramStatus !== null && telegramStatus.linked && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "var(--ink-muted)", fontSize: 14 }}>
                  {telegramStatus.username ? `@${telegramStatus.username}` : "เชื่อมต่อแล้ว"} · {String(telegramStatus.linkedAt).slice(0, 10)}
                </span>
                <button onClick={handleRevokeTelegram} style={{ padding: "6px 14px", borderRadius: 6, background: "var(--surface)", color: "var(--ink-muted)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 14 }}>
                  ยกเลิกการเชื่อมต่อ
                </button>
              </div>
            )}
          </div>

          {/* Report-issue card */}
          <div style={{ marginTop: 14, padding: "16px 20px", background: "var(--surface-raised)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>แจ้งปัญหาถึงแอดมิน</div>
                <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>พบปัญหาการใช้งาน? แจ้งให้แอดมินทราบได้ที่นี่</div>
              </div>
              {!reportOpen && (
                <button
                  onClick={() => { setReportOpen(true); setReportStatus("idle"); }}
                  style={{ padding: "6px 14px", borderRadius: 6, background: "#2563EB", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, flexShrink: 0, fontFamily: "inherit" }}
                >
                  แจ้งปัญหา
                </button>
              )}
            </div>

            {reportStatus === "sent" && !reportOpen && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
                ส่งให้แอดมินแล้ว ✓
              </div>
            )}

            {reportOpen && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="อธิบายปัญหาที่พบ เช่น หน้าไหน กดอะไรแล้วเกิดอะไรขึ้น…"
                  maxLength={2000}
                  rows={4}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--ink)", fontSize: 14, fontFamily: "inherit", resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                {reportStatus === "error" && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#DC2626" }}>
                    ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => { setReportOpen(false); setReportStatus("idle"); }}
                    disabled={reportStatus === "sending"}
                    style={{ padding: "7px 14px", borderRadius: 6, background: "var(--surface)", color: "var(--ink-muted)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={!reportText.trim() || reportStatus === "sending"}
                    style={{
                      padding: "7px 16px", borderRadius: 6,
                      background: (!reportText.trim() || reportStatus === "sending") ? "rgba(37,99,235,0.45)" : "#2563EB",
                      color: "#fff", border: "none",
                      cursor: (!reportText.trim() || reportStatus === "sending") ? "not-allowed" : "pointer",
                      fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                    }}
                  >
                    {reportStatus === "sending" ? "กำลังส่ง…" : "ส่งให้แอดมิน"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Logout button */}
          <button
            className="pf-card-3 pf-logout-btn"
            onClick={handleLogout}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
              background: "rgba(239,68,68,0.07)", color: "#DC2626",
              fontSize: 14.5, fontWeight: 700, cursor: "pointer",
              boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.18)",
              fontFamily: "inherit",
            }}
          >
            ออกจากระบบ
          </button>

          <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: "var(--ink-muted, #CBD5E1)" }}>
            Complete Auto Rubber Co., Ltd. · HR&amp;GA Workflow System
          </div>
        </div>
      </div>
    </>
  );
}
