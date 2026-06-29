"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #E2E8F0", background: "#FAFBFF", color: "#0D1B2A",
  fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally swallow: the response is identical regardless, so the
      // page never reveals whether the address has an account.
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9", padding: 24, fontFamily: "'Sarabun', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: "36px 34px", boxShadow: "0 12px 40px rgba(15,23,42,0.10)" }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0D1B2A", margin: "0 0 6px" }}>ลืมรหัสผ่าน</h1>
        <p style={{ fontSize: 13.5, color: "#64748B", margin: "0 0 24px", lineHeight: 1.6 }}>
          กรอกอีเมลบริษัทของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้
        </p>

        {submitted ? (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)", color: "#047857", fontSize: 13.5, lineHeight: 1.6 }}>
            หากอีเมลนี้มีบัญชีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว (ลิงก์หมดอายุใน 60 นาที) กรุณาตรวจสอบกล่องอีเมลของคุณ
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 7 }}>อีเมล</label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@car-1996.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ ...inputStyle, marginBottom: 20 }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: loading ? "#94A3B8" : "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "กำลังส่ง…" : "ส่งลิงก์รีเซ็ต"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 13.5 }}>
          <Link href="/login" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700 }}>
            ← กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
