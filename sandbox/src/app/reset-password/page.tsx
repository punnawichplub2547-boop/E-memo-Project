"use client";

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #E2E8F0", background: "#FAFBFF", color: "#0D1B2A",
  fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

function ResetPasswordInner() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ไม่สามารถตั้งรหัสผ่านใหม่ได้");
        return;
      }
      setDone(true);
    } catch {
      setError("การเชื่อมต่อมีปัญหา กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: "36px 34px", boxShadow: "0 12px 40px rgba(15,23,42,0.10)" }}>
      <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0D1B2A", margin: "0 0 6px" }}>ตั้งรหัสผ่านใหม่</h1>

      {done ? (
        <>
          <div style={{ margin: "18px 0", padding: "14px 16px", borderRadius: 10, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)", color: "#047857", fontSize: 13.5, lineHeight: 1.6 }}>
            ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
          </div>
          <Link href="/login" style={{ display: "block", textAlign: "center", color: "#2563EB", textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>
            ไปหน้าเข้าสู่ระบบ →
          </Link>
        </>
      ) : !token ? (
        <p style={{ fontSize: 13.5, color: "#DC2626", margin: "16px 0", lineHeight: 1.6 }}>
          ลิงก์ไม่ถูกต้อง — ไม่พบ token กรุณาขอลิงก์รีเซ็ตใหม่อีกครั้ง
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: 13.5, color: "#64748B", margin: "0 0 22px", lineHeight: 1.6 }}>
            ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ (อย่างน้อย 8 ตัวอักษร)
          </p>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 7 }}>รหัสผ่านใหม่</label>
          <input
            type="password" required autoComplete="new-password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16 }}
          />
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 7 }}>ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password" required autoComplete="new-password" placeholder="••••••••"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            style={{ ...inputStyle, marginBottom: 20 }}
          />
          {error && (
            <div style={{ marginBottom: 18, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#DC2626", fontSize: 13.5 }}>
              {error}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
              background: loading ? "#94A3B8" : "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            {loading ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9", padding: 24, fontFamily: "'Sarabun', sans-serif" }}>
      <Suspense fallback={null}>
        <ResetPasswordInner />
      </Suspense>
    </div>
  );
}
