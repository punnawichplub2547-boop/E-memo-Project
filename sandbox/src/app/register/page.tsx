"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";
import { IconEye, IconEyeOff } from "@/components/icons";

type Stage = "form" | "success";

export default function RegisterPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [employeeCardId, setEmployeeCardId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("HR&GA");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[A-Za-z0-9]+$/.test(employeeCardId)) {
      setError("Employee card ID must be letters and numbers only");
      return;
    }
    if (!email.endsWith("@car-1996.com")) {
      setError("Email must end with @car-1996.com");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCardId, firstName, lastName, email, password, department }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      setStage("success");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (stage === "success") {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
          @keyframes rg-check-pop {
            0%   { transform: scale(0.5); opacity: 0; }
            70%  { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes rg-fade-up {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(148deg, #060C1F 0%, #0B1735 42%, #102060 100%)",
          padding: 24, fontFamily: "'Sarabun', system-ui, sans-serif",
        }}>
          <div style={{
            width: "100%", maxWidth: 420,
            background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 20, padding: "48px 40px",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
              background: "linear-gradient(135deg, #16A34A, #22C55E)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "rg-check-pop 0.5s ease both",
              boxShadow: "0 8px 28px rgba(34,197,94,0.4)",
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M7 16l6 6 12-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#EDF4FF", marginBottom: 10, fontFamily: "'Syne', sans-serif", animation: "rg-fade-up 0.45s 0.1s ease both" }}>
              ส่งคำขอสำเร็จ
            </div>
            <div style={{ fontSize: 14, color: "rgba(147,197,253,0.75)", lineHeight: 1.7, marginBottom: 32, animation: "rg-fade-up 0.45s 0.2s ease both" }}>
              บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ<br />
              HR&amp;GA will review and activate your account.
            </div>
            <Link href="/login" style={{
              display: "inline-block", padding: "12px 36px", borderRadius: 10,
              background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
              color: "#fff", fontSize: 14.5, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 4px 18px rgba(37,99,235,0.4)",
              animation: "rg-fade-up 0.45s 0.3s ease both",
            }}>
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');

        @keyframes rg-float-a {
          0%,100% { transform: translateY(0px) scale(1); }
          50%     { transform: translateY(-20px) scale(1.04); }
        }
        @keyframes rg-float-b {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-13px); }
        }
        @keyframes rg-logo-pulse {
          0%,100% { box-shadow: 0 0 28px rgba(59,130,246,0.55), 0 0 56px rgba(59,130,246,0.22); }
          50%     { box-shadow: 0 0 44px rgba(59,130,246,0.85), 0 0 88px rgba(59,130,246,0.38); }
        }
        @keyframes rg-ring-cw  { to { transform: rotate(360deg); } }
        @keyframes rg-ring-ccw { to { transform: rotate(-360deg); } }
        @keyframes rg-streak {
          0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateX(260%) skewX(-15deg); opacity: 0; }
        }
        @keyframes rg-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rg-dot-blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }

        .rg-streak {
          position: absolute; top: 0; bottom: 0; pointer-events: none;
        }
        .rg-streak-1 {
          left: 0; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.08), transparent);
          animation: rg-streak 8s ease-in-out infinite;
        }
        .rg-streak-2 {
          left: 0; width: 22%;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.06), transparent);
          animation: rg-streak 11s ease-in-out infinite;
          animation-delay: -4s;
        }
        .rg-streak-3 {
          left: 0; width: 55%;
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.05), transparent);
          animation: rg-streak 14s ease-in-out infinite;
          animation-delay: -7s;
        }

        .rg-input {
          width: 100%; padding: 10px 13px; border-radius: 9px;
          border: 1.5px solid #E2E8F0; background: #FAFBFF;
          color: #0D1B2A; font-size: 13.5px; outline: none;
          box-sizing: border-box; font-family: inherit;
          transition: border-color 180ms, box-shadow 180ms;
        }
        .rg-input:focus {
          border-color: #2563EB !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
          background: #fff !important;
        }
        .rg-input-pw { padding-right: 40px !important; }

        .rg-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px !important;
        }
        .rg-step { animation: rg-fade-up 0.5s ease both; }
        .rg-step:nth-child(1) { animation-delay: 0.1s; }
        .rg-step:nth-child(2) { animation-delay: 0.2s; }
        .rg-step:nth-child(3) { animation-delay: 0.3s; }
        .rg-form-wrap { animation: rg-fade-up 0.4s 0.05s ease both; }
        .rg-submit-btn { transition: transform 150ms, box-shadow 200ms; }
        .rg-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(37,99,235,0.4) !important;
        }
        .rg-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .rg-eye-btn {
          position: absolute; top: 50%; right: 9px;
          transform: translateY(-50%);
          width: 28px; height: 28px; border: none; border-radius: 6px;
          background: transparent; color: #94A3B8;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
        }

        @media (max-width: 820px) { .rg-left { display: none !important; } }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Sarabun', 'Inter', system-ui, sans-serif" }}>

        {/* ── LEFT brand panel ─────────────────────────────────── */}
        <div className="rg-left" style={{
          flex: "0 0 420px",
          background: "linear-gradient(148deg, #060C1F 0%, #0B1735 42%, #102060 100%)",
          display: "flex", flexDirection: "column",
          padding: "52px 44px",
          position: "relative", overflow: "hidden",
        }}>
          {/* Streaks */}
          <div className="rg-streak rg-streak-1" />
          <div className="rg-streak rg-streak-2" />
          <div className="rg-streak rg-streak-3" />

          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(rgba(147,197,253,0.09) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(180deg, transparent 5%, rgba(0,0,0,0.5) 25%, rgba(0,0,0,0.5) 75%, transparent 95%)",
          }} />

          {/* Orb A */}
          <div style={{
            position: "absolute", zIndex: 0,
            top: -80, right: -80, width: 320, height: 320, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 68%)",
            animation: "rg-float-a 9s ease-in-out infinite",
          }} />
          {/* Orb B */}
          <div style={{
            position: "absolute", zIndex: 0,
            bottom: 40, left: -60, width: 240, height: 240, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 68%)",
            animation: "rg-float-b 12s ease-in-out infinite", animationDelay: "-4s",
          }} />

          {/* Rings */}
          <div style={{
            position: "absolute", zIndex: 0,
            top: 140, right: -50, width: 220, height: 220, borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.14)",
            animation: "rg-ring-cw 22s linear infinite",
          }} />
          <div style={{
            position: "absolute", zIndex: 0,
            top: 162, right: -28, width: 176, height: 176, borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.08)",
            animation: "rg-ring-ccw 34s linear infinite",
          }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Logo */}
            <div style={{ marginBottom: 44 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 80, height: 60, borderRadius: 16,
                background: "rgba(255,255,255,0.94)",
                animation: "rg-logo-pulse 3.2s ease-in-out infinite",
                marginBottom: 24,
                padding: "8px 10px",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/CARLOGO.png" alt="Complete Auto Rubber" style={{ width: 56, height: "auto", display: "block" }} />
              </div>

              <div style={{
                fontSize: 30, fontWeight: 800, color: "#EDF4FF",
                fontFamily: "'Syne', sans-serif",
                letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8,
              }}>เข้าร่วมทีมงาน</div>
              <div style={{ fontSize: 14.5, color: "rgba(147,197,253,0.8)", fontWeight: 500, marginBottom: 4 }}>
                ลงทะเบียนเพื่อใช้งานระบบ E-Memo
              </div>
              <div style={{ fontSize: 11.5, color: "rgba(147,197,253,0.4)", letterSpacing: "0.06em", fontWeight: 500, textTransform: "uppercase" }}>
                Complete Auto Rubber · HR&amp;GA
              </div>
            </div>

            {/* Accent */}
            <div style={{
              width: 44, height: 2.5, borderRadius: 2, marginBottom: 32,
              background: "linear-gradient(90deg, #3B82F6, rgba(59,130,246,0.2))",
            }} />

            {/* Registration steps */}
            <div style={{ fontSize: 12, color: "rgba(147,197,253,0.5)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
              ขั้นตอนการสมัคร
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              {([
                { n: "01", th: "กรอกข้อมูลส่วนตัว",    en: "Fill in your details",          done: true },
                { n: "02", th: "รอการอนุมัติจาก Admin", en: "Await admin approval",           done: false },
                { n: "03", th: "เข้าสู่ระบบและเริ่มใช้งาน", en: "Sign in and get started",   done: false },
              ] as const).map((s, i) => (
                <div key={i} className="rg-step" style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                    background: i === 0
                      ? "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(59,130,246,0.7))"
                      : "rgba(59,130,246,0.12)",
                    border: i === 0 ? "none" : "1px solid rgba(59,130,246,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    color: i === 0 ? "#fff" : "rgba(147,197,253,0.4)",
                    boxShadow: i === 0 ? "0 2px 10px rgba(37,99,235,0.45)" : "none",
                  }}>
                    {s.n}
                  </div>
                  <div style={{ paddingTop: 5 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: i === 0 ? "#DBE9FF" : "rgba(147,197,253,0.45)", lineHeight: 1.3 }}>{s.th}</div>
                    <div style={{ fontSize: 11.5, color: i === 0 ? "rgba(147,197,253,0.5)" : "rgba(147,197,253,0.25)", marginTop: 2 }}>{s.en}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Status */}
            <div style={{ marginTop: 40 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 20,
                border: "1px solid rgba(59,130,246,0.22)",
                background: "rgba(37,99,235,0.09)",
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#22C55E",
                  boxShadow: "0 0 7px rgba(34,197,94,0.7)",
                  animation: "rg-dot-blink 2.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 11.5, color: "rgba(147,197,253,0.58)", fontWeight: 500 }}>
                  System Online · IT Department
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT form panel ─────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 24px", background: "#FFFFFF", overflowY: "auto",
        }}>
          <div className="rg-form-wrap" style={{ width: "100%", maxWidth: 420, paddingBlock: 24 }}>

            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 26, fontWeight: 800, color: "#0D1B2A",
                fontFamily: "'Syne', sans-serif", letterSpacing: "-0.3px", marginBottom: 6,
              }}>
                สร้างบัญชี
              </div>
              <div style={{ fontSize: 13.5, color: "#64748B" }}>
                Create your E-Memo account
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Name row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>ชื่อ <span style={{ color: "#EF4444" }}>*</span></label>
                  <input className="rg-input" type="text" required placeholder="ชื่อ" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>นามสกุล <span style={{ color: "#EF4444" }}>*</span></label>
                  <input className="rg-input" type="text" required placeholder="นามสกุล" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              {/* Card ID */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Employee Card ID <span style={{ color: "#EF4444" }}>*</span></label>
                <input
                  className="rg-input"
                  type="text" required
                  placeholder="e.g. 6905003S"
                  value={employeeCardId}
                  onChange={e => setEmployeeCardId(e.target.value.toUpperCase())}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Company Email <span style={{ color: "#EF4444" }}>*</span></label>
                <input
                  className="rg-input"
                  type="email" required
                  placeholder="name@car-1996.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {/* Department */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>แผนก</label>
                <select className="rg-input rg-select" value={department} onChange={e => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Password <span style={{ color: "#EF4444" }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    className="rg-input rg-input-pw"
                    type={showPassword ? "text" : "password"}
                    required autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button type="button" className="rg-eye-btn" aria-label={showPassword ? "Hide" : "Show"} onClick={() => setShowPassword(p => !p)}>
                    {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Confirm Password <span style={{ color: "#EF4444" }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    className="rg-input rg-input-pw"
                    type={showConfirm ? "text" : "password"}
                    required autoComplete="new-password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button type="button" className="rg-eye-btn" aria-label={showConfirm ? "Hide" : "Show"} onClick={() => setShowConfirm(p => !p)}>
                    {showConfirm ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 16, padding: "10px 14px", borderRadius: 8,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#DC2626", fontSize: 13.5,
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                className="rg-submit-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                  background: loading ? "#94A3B8" : "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 18px rgba(37,99,235,0.32)",
                  fontFamily: "inherit",
                }}
              >
                {loading ? "กำลังส่งคำขอ…" : "ส่งคำขอลงทะเบียน"}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 13.5, color: "#64748B" }}>
              มีบัญชีอยู่แล้ว?{" "}
              <Link href="/login" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700 }}>
                เข้าสู่ระบบ
              </Link>
            </div>

            <div style={{ marginTop: 36, textAlign: "center", fontSize: 11.5, color: "#CBD5E1" }}>
              Complete Auto Rubber Co., Ltd. · HR&amp;GA Workflow System
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 600,
  color: "#475569", marginBottom: 6, letterSpacing: "0.01em",
};
