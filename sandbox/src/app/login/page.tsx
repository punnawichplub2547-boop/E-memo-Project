"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { IconEye, IconEyeOff } from "@/components/icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');

        @keyframes em-float-a {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-22px) scale(1.04); }
        }
        @keyframes em-float-b {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-14px) scale(0.97); }
        }
        @keyframes em-float-c {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-9px); }
        }
        @keyframes em-logo-pulse {
          0%,100% { box-shadow: 0 0 28px rgba(59,130,246,0.55), 0 0 56px rgba(59,130,246,0.22); }
          50%      { box-shadow: 0 0 44px rgba(59,130,246,0.85), 0 0 88px rgba(59,130,246,0.38), 0 0 120px rgba(147,197,253,0.16); }
        }
        @keyframes em-car-square-breathe {
          0%,100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 18px 48px rgba(15,23,42,0.26), 0 0 34px rgba(59,130,246,0.38), 0 0 0 1px rgba(255,255,255,0.78) inset;
          }
          50% {
            transform: translateY(-3px) scale(1.035);
            box-shadow: 0 24px 58px rgba(15,23,42,0.34), 0 0 52px rgba(59,130,246,0.62), 0 0 0 1px rgba(255,255,255,0.92) inset;
          }
        }
        @keyframes em-car-square-sheen {
          0%,18% { transform: translateX(-155%) rotate(18deg); opacity: 0; }
          34% { opacity: 0.9; }
          58%,100% { transform: translateX(150%) rotate(18deg); opacity: 0; }
        }
        @keyframes em-car-logo-drift {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes em-ring-cw  { to { transform: rotate(360deg); } }
        @keyframes em-ring-ccw { to { transform: rotate(-360deg); } }
        @keyframes em-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes em-dot-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        @keyframes em-streak {
          0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateX(260%) skewX(-15deg); opacity: 0; }
        }

        .em-login-streak {
          position: absolute; top: 0; bottom: 0;
          width: 35%; pointer-events: none; z-index: 0;
        }
        .em-login-streak-1 {
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.08), transparent);
          animation: em-streak 7s ease-in-out infinite;
          animation-delay: 0s;
        }
        .em-login-streak-2 {
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.06), transparent);
          width: 20%;
          animation: em-streak 9s ease-in-out infinite;
          animation-delay: -3s;
        }
        .em-login-streak-3 {
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.05), transparent);
          width: 50%;
          animation: em-streak 12s ease-in-out infinite;
          animation-delay: -6s;
        }

        .em-login-input {
          transition: border-color 180ms, box-shadow 180ms;
        }
        .em-login-input:focus {
          border-color: #2563EB !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.13) !important;
          outline: none;
          background: #FFFFFF !important;
        }
        .em-login-btn {
          transition: transform 150ms, box-shadow 200ms, opacity 150ms;
        }
        .em-login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(37,99,235,0.42) !important;
        }
        .em-login-btn:active:not(:disabled) { transform: translateY(0); }

        .em-feat { animation: em-fade-up 0.55s ease both; }
        .em-feat:nth-child(1) { animation-delay: 0.15s; }
        .em-feat:nth-child(2) { animation-delay: 0.25s; }
        .em-feat:nth-child(3) { animation-delay: 0.35s; }
        .em-feat:nth-child(4) { animation-delay: 0.45s; }

        .em-form-wrap { animation: em-fade-up 0.45s 0.05s ease both; }

        .em-form-pane {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }
        .em-form-pane::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image: url('/login-building-bg.jpg');
          background-size: cover;
          background-position: center right;
          opacity: 0.38;
          filter: saturate(1.02) contrast(1);
          transform: scale(1.02);
        }
        .em-form-pane::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(112deg,
              #FFFFFF 0%,
              #FFFFFF 38%,
              rgba(255,255,255,0.86) 53%,
              rgba(255,255,255,0.50) 72%,
              rgba(255,255,255,0.18) 100%),
            linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.88) 100%);
        }
        .em-form-wrap {
          position: relative;
          z-index: 1;
        }

        .em-car-logo-square {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          padding: 11px;
          border-radius: 18px;
          overflow: hidden;
          isolation: isolate;
          background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.98), rgba(248,251,255,0.88) 38%, rgba(219,234,254,0.96) 100%);
          border: 1px solid rgba(255,255,255,0.7);
          animation: em-car-square-breathe 4.2s ease-in-out infinite;
        }
        .em-car-logo-square::before {
          content: "";
          position: absolute;
          inset: 6px;
          border-radius: 14px;
          border: 1px solid rgba(37,99,235,0.14);
          background: radial-gradient(circle at 50% 50%, rgba(59,130,246,0.10), transparent 62%);
          z-index: 0;
        }
        .em-car-logo-square::after {
          content: "";
          position: absolute;
          top: -25%;
          bottom: -25%;
          left: 0;
          width: 42%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.88), transparent);
          filter: blur(0.5px);
          animation: em-car-square-sheen 4.8s ease-in-out infinite;
          pointer-events: none;
          z-index: 2;
        }
        .em-car-logo-square img {
          position: relative;
          z-index: 1;
          width: 54px;
          height: auto;
          display: block;
          filter: drop-shadow(0 7px 12px rgba(15,23,42,0.12));
          animation: em-car-logo-drift 4.2s ease-in-out infinite;
        }
        .em-car-logo-square--mobile {
          width: 74px;
          height: 74px;
          margin-bottom: 16px;
        }
        .em-car-logo-square--mobile img { width: 55px; }
        /* Backup old logo treatment: add this class to restore the previous rounded-rectangle pulse. */
        .em-car-logo-square--legacy {
          width: 80px;
          height: 66px;
          border-radius: 16px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.94);
          border: none;
          animation: em-logo-pulse 3.2s ease-in-out infinite;
        }
        .em-car-logo-square--legacy::before,
        .em-car-logo-square--legacy::after { display: none; }
        .em-car-logo-square--legacy img {
          width: 56px;
          animation: none;
          filter: none;
        }

        /* Mobile-only brand header — hidden on desktop */
        .em-mobile-brand { display: none; }

        /* ── Mobile / tablet (≤820px): immersive brand background + glass card ── */
        @media (max-width: 820px) {
          /* Desktop split panel hidden; its atmosphere moves to the full screen */
          .em-login-left { display: none !important; }

          .em-login-root {
            display: block !important;
            position: relative;
            overflow: hidden;
            background: linear-gradient(180deg, #F7FAFF 0%, #FFFFFF 58%, #F8FBFF 100%) !important;
          }

          /* Brand atmosphere layers fill the whole mobile screen */
          .em-mobile-atmos {
            position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
          }
          .em-mobile-atmos::before {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 52%;
            background-image: url('/login-building-bg.jpg');
            background-size: cover;
            background-position: center top;
            opacity: 0.42;
            filter: saturate(1.02) contrast(1);
            mask-image: linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.72) 54%, transparent 100%);
            -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.72) 54%, transparent 100%);
          }
          .em-mobile-atmos::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(164deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.58) 38%, transparent 39%),
              linear-gradient(180deg, rgba(255,255,255,0.06) 0%, #FFFFFF 60%, rgba(248,251,255,0.92) 100%);
          }
          .em-mobile-atmos .em-orb-top {
            position: absolute; top: -130px; right: -110px;
            width: 320px; height: 320px; border-radius: 50%;
            background: radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 68%);
            animation: em-float-a 9s ease-in-out infinite;
          }
          .em-mobile-atmos .em-orb-bottom {
            position: absolute; bottom: -90px; left: -90px;
            width: 300px; height: 300px; border-radius: 50%;
            background: radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 68%);
            animation: em-float-b 12s ease-in-out infinite; animation-delay: -4s;
          }
          .em-mobile-atmos .em-dotgrid {
            position: absolute; inset: 0;
            background-image: radial-gradient(rgba(37,99,235,0.07) 1px, transparent 1px);
            background-size: 26px 26px;
            mask-image: linear-gradient(180deg, transparent 2%, rgba(0,0,0,0.5) 22%, rgba(0,0,0,0.5) 78%, transparent 98%);
            -webkit-mask-image: linear-gradient(180deg, transparent 2%, rgba(0,0,0,0.5) 22%, rgba(0,0,0,0.5) 78%, transparent 98%);
          }

          /* Right pane becomes a transparent full-screen scroll container */
          .em-form-pane {
            background: transparent !important;
            position: relative; z-index: 1;
            min-height: 100dvh;
            padding: 34px 22px calc(28px + env(safe-area-inset-bottom)) !important;
            align-items: flex-start !important;
          }
          .em-form-pane::before,
          .em-form-pane::after {
            display: none;
          }
          .em-form-wrap {
            margin: auto;
            max-width: 380px !important;
          }

          /* Mobile brand header — logo + wordmark above the card */
          .em-mobile-brand {
            display: flex; flex-direction: column; align-items: center;
            text-align: center; margin-bottom: 22px;
            padding-top: calc(env(safe-area-inset-top) * 0.5);
          }
          .em-mobile-brand .em-mb-logo {
            display: inline-flex; align-items: center; justify-content: center;
            width: 76px; height: 64px; border-radius: 16px; padding: 8px 10px;
            background: rgba(255,255,255,0.95);
            animation: em-logo-pulse 3.2s ease-in-out infinite;
            margin-bottom: 16px;
          }
          .em-mobile-brand .em-mb-logo.em-car-logo-square {
            width: 74px;
            height: 74px;
            border-radius: 18px;
            padding: 11px;
            background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.98), rgba(248,251,255,0.88) 38%, rgba(219,234,254,0.96) 100%);
            animation: em-car-square-breathe 4.2s ease-in-out infinite;
          }
          .em-mobile-brand .em-mb-title {
            font-size: 30px; font-weight: 800; color: #0F255C;
            font-family: 'Syne', sans-serif; letter-spacing: -0.5px; line-height: 1.1;
          }
          .em-mobile-brand .em-mb-sub {
            font-size: 13px; color: rgba(30,64,175,0.72); font-weight: 500; margin-top: 5px;
          }
          .em-mobile-brand .em-mb-co {
            font-size: 10px; color: rgba(30,64,175,0.42); font-weight: 500;
            letter-spacing: 0.07em; text-transform: uppercase; margin-top: 7px;
          }

          /* Form card → glass panel on the dark brand background */
          .em-login-card {
            background: rgba(255,255,255,0.97) !important;
            border: 1px solid rgba(219,234,254,0.92);
            border-radius: 20px;
            padding: 28px 22px 26px !important;
            box-shadow: 0 24px 60px -24px rgba(30,58,138,0.26), 0 0 0 1px rgba(59,130,246,0.06);
          }
          /* Footer reads on dark bg outside the card */
          .em-mobile-footer { color: rgba(71,85,105,0.54) !important; margin-top: 26px !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .em-login-streak, .em-mobile-atmos .em-orb-top, .em-mobile-atmos .em-orb-bottom,
          .em-mb-logo, .em-car-logo-square, .em-car-logo-square::after,
          .em-car-logo-square img, .em-feat, .em-form-wrap { animation: none !important; }
        }
      `}</style>

      <div className="em-login-root" style={{ minHeight: "100vh", display: "flex", fontFamily: "'Sarabun', 'Inter', system-ui, sans-serif" }}>

        {/* Mobile-only brand atmosphere (orbs + dot grid) — invisible on desktop */}
        <div className="em-mobile-atmos" aria-hidden="true">
          <div className="em-orb-top" />
          <div className="em-orb-bottom" />
          <div className="em-dotgrid" />
        </div>

        {/* ── LEFT brand panel ─────────────────────────────────── */}
        <div className="em-login-left" style={{
          flex: "0 0 460px",
          background: "linear-gradient(148deg, #060C1F 0%, #0B1735 42%, #102060 100%)",
          display: "flex", flexDirection: "column",
          padding: "52px 48px",
          position: "relative", overflow: "hidden",
        }}>

          {/* Traveling light streaks */}
          <div className="em-login-streak em-login-streak-1" />
          <div className="em-login-streak em-login-streak-2" />
          <div className="em-login-streak em-login-streak-3" />

          {/* Dot-grid texture */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: "radial-gradient(rgba(147,197,253,0.09) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(180deg, transparent 5%, rgba(0,0,0,0.55) 25%, rgba(0,0,0,0.55) 75%, transparent 95%)",
          }} />

          {/* Orb A — top right */}
          <div style={{
            position: "absolute", zIndex: 0,
            top: -100, right: -100, width: 360, height: 360, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 68%)",
            animation: "em-float-a 9s ease-in-out infinite",
          }} />

          {/* Orb B — bottom left */}
          <div style={{
            position: "absolute", zIndex: 0,
            bottom: 60, left: -80, width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 68%)",
            animation: "em-float-b 12s ease-in-out infinite", animationDelay: "-4s",
          }} />

          {/* Orb C — mid right */}
          <div style={{
            position: "absolute", zIndex: 0,
            top: "38%", right: 32, width: 130, height: 130, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,197,253,0.14) 0%, transparent 70%)",
            animation: "em-float-c 6.5s ease-in-out infinite", animationDelay: "-2s",
          }} />

          {/* Rotating rings */}
          <div style={{
            position: "absolute", zIndex: 0,
            top: 160, right: -56, width: 240, height: 240, borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.14)",
            animation: "em-ring-cw 22s linear infinite",
          }} />
          <div style={{
            position: "absolute", zIndex: 0,
            top: 184, right: -32, width: 192, height: 192, borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.08)",
            animation: "em-ring-ccw 34s linear infinite",
          }} />

          {/* ── Content ── */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

            {/* Logo + brand */}
            <div style={{ marginBottom: 44 }}>
              <div className="em-car-logo-square" style={{ marginBottom: 26 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/CARLOGO.png" alt="Complete Auto Rubber" />
              </div>

              <div style={{
                fontSize: 34, fontWeight: 800, color: "#EDF4FF",
                fontFamily: "'Syne', sans-serif",
                letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8,
              }}>E-Memo</div>

              <div style={{ fontSize: 15.5, color: "rgba(147,197,253,0.82)", fontWeight: 500, marginBottom: 5 }}>
                ระบบบันทึกข้อความภายใน
              </div>
              <div style={{ fontSize: 12, color: "rgba(147,197,253,0.4)", letterSpacing: "0.06em", fontWeight: 500, textTransform: "uppercase" }}>
                Complete Auto Rubber Manufacturing Co.,Ltd.
              </div>
            </div>

            {/* Accent bar */}
            <div style={{
              width: 44, height: 2.5, borderRadius: 2, marginBottom: 32,
              background: "linear-gradient(90deg, #3B82F6, rgba(59,130,246,0.2))",
            }} />

            {/* Features */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
              {([
                { th: "สร้างและส่งเมโมดิจิทัล",           en: "Create & send digital memos" },
                { th: "อนุมัติตามสายการบังคับบัญชา",      en: "Hierarchical approval workflow" },
                { th: "ติดตามสถานะแบบ Real-time",         en: "Real-time status tracking" },
                { th: "บันทึกประวัติและรายงานตรวจสอบ",    en: "Audit trail & history reports" },
              ] as const).map((f, i) => (
                <div key={i} className="em-feat" style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: "50%", marginTop: 1,
                    background: "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(59,130,246,0.7))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 10px rgba(37,99,235,0.45)",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2.5 5.5l2.5 2.5L8.5 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#DBE9FF", lineHeight: 1.35 }}>{f.th}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(147,197,253,0.45)", marginTop: 2 }}>{f.en}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* System status pill */}
            <div style={{ marginTop: 44 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 20,
                border: "1px solid rgba(59,130,246,0.22)",
                background: "rgba(37,99,235,0.09)",
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#22C55E",
                  boxShadow: "0 0 7px rgba(34,197,94,0.7)",
                  animation: "em-dot-blink 2.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 11.5, color: "rgba(147,197,253,0.58)", fontWeight: 500, letterSpacing: "0.02em" }}>
                  System Online · IT Department
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT form panel ─────────────────────────────────── */}
        <div className="em-form-pane" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 24px", background: "#FFFFFF",
        }}>
          <div className="em-form-wrap" style={{ width: "100%", maxWidth: 400 }}>

            {/* Mobile-only brand header (logo + wordmark) — hidden ≥820px */}
            <div className="em-mobile-brand">
              <span className="em-mb-logo em-car-logo-square em-car-logo-square--mobile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/CARLOGO.png" alt="Complete Auto Rubber" />
              </span>
              <span className="em-mb-title">E-Memo</span>
              <span className="em-mb-sub">ระบบบันทึกข้อความภายใน</span>
              <span className="em-mb-co">Complete Auto Rubber Mfg. Co.,Ltd.</span>
            </div>

            <div className="em-login-card">

            {/* Heading */}
            <div style={{ marginBottom: 34 }}>
              <div style={{
                fontSize: 28, fontWeight: 800, color: "#0D1B2A",
                fontFamily: "'Syne', sans-serif", letterSpacing: "-0.3px", marginBottom: 6,
              }}>
                ยินดีต้อนรับ
              </div>
              <div style={{ fontSize: 14, color: "#64748B" }}>
                Sign in to your E-Memo account
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 7, letterSpacing: "0.01em" }}>
                  Company Email
                </label>
                <input
                  className="em-login-input"
                  type="email"
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="name@car-1996.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 14px",
                    borderRadius: 10, border: "1.5px solid #E2E8F0",
                    background: "#FAFBFF", color: "#0D1B2A",
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 26 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 7, letterSpacing: "0.01em" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="em-login-input"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      width: "100%", padding: "11px 44px 11px 14px",
                      borderRadius: 10, border: "1.5px solid #E2E8F0",
                      background: "#FAFBFF", color: "#0D1B2A",
                      fontSize: 14, outline: "none", boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: "absolute", top: "50%", right: 10,
                      transform: "translateY(-50%)",
                      width: 30, height: 30, border: "none", borderRadius: 7,
                      background: "transparent", color: "#94A3B8",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
                <div style={{ marginTop: 9, textAlign: "right" }}>
                  <Link href="/forgot-password" style={{ fontSize: 12.5, color: "#2563EB", textDecoration: "none", fontWeight: 600 }}>
                    ลืมรหัสผ่าน?
                  </Link>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 18, padding: "10px 14px", borderRadius: 8,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#DC2626", fontSize: 13.5,
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                className="em-login-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                  background: loading
                    ? "#94A3B8"
                    : "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 18px rgba(37,99,235,0.32)",
                  fontFamily: "inherit", letterSpacing: "0.01em",
                }}
              >
                {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </button>
            </form>

            {/* Register */}
            <div style={{ marginTop: 22, textAlign: "center", fontSize: 13.5, color: "#64748B" }}>
              ยังไม่มีบัญชี?{" "}
              <Link href="/register" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700 }}>
                ลงทะเบียน
              </Link>
            </div>

            </div>{/* /em-login-card */}

            {/* Footer */}
            <div className="em-mobile-footer" style={{ marginTop: 44, textAlign: "center", fontSize: 11.5, color: "#CBD5E1" }}>
              Complete Auto Rubber Co., Ltd. · HR&amp;GA Workflow System
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
