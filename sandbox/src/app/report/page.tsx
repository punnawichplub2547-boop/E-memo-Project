"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { IconBarChart, IconArrowLeft, IconArrowRight } from "@/components/icons";

const ALLOWED_ROLES = ["admin", "manager", "general-manager", "managing-director"];

type ReportData = {
  month: string;
  total: number;
  byStatus: {
    pending: number;
    approved: number;
    rejected: number;
    returned: number;
    draft: number;
  };
  byDepartment: {
    department: string;
    submitted: number;
    approved: number;
    rejected: number;
    budgetTotal: number;
  }[];
};

function toMonthParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(param: string): string {
  const [y, m] = param.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

export default function ReportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [month, setMonth] = useState(() => toMonthParam(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [fetching, setFetching] = useState(false);

  const canAccess = !loading && user && user.roles.some(r => ALLOWED_ROLES.includes(r));

  useEffect(() => {
    if (!loading && (!user || !canAccess)) {
      router.replace("/");
    }
  }, [loading, user, canAccess, router]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    async function load() {
      setFetching(true);
      setData(null);
      try {
        const res = await fetch(`/api/report?month=${month}`);
        if (!cancelled && res.ok) setData(await res.json());
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [month, canAccess]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(toMonthParam(d));
  };

  if (loading || !canAccess) return null;

  return (
    <main style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <IconBarChart size={20} style={{ color: "var(--primary)" }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>รายงานประจำเดือน / Monthly Report</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          className="em-btn sm"
          onClick={() => shiftMonth(-1)}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <IconArrowLeft size={14} /> ก่อนหน้า
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 160, textAlign: "center" }}>
          {formatMonthLabel(month)}
        </span>
        <button
          className="em-btn sm"
          onClick={() => shiftMonth(1)}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          ถัดไป <IconArrowRight size={14} />
        </button>
      </div>

      {fetching && (
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>กำลังโหลด...</div>
      )}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Memo ทั้งหมด", value: data.total, color: "var(--primary)" },
              { label: "อนุมัติแล้ว", value: data.byStatus.approved, color: "#059669" },
              { label: "ปฏิเสธ", value: data.byStatus.rejected, color: "#DC2626" },
            ].map(({ label, value, color }) => (
              <div key={label} className="em-card" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          <div className="em-card" style={{ marginBottom: 20 }}>
            <div className="em-card-head"><h3>สถานะ Memo</h3></div>
            <div className="em-card-body">
              {(["pending", "approved", "rejected", "returned", "draft"] as const).map(key => ({
                key,
                label: { pending: "รออนุมัติ (Pending)", approved: "อนุมัติแล้ว (Approved)", rejected: "ปฏิเสธ (Rejected)", returned: "ส่งคืน (Returned)", draft: "ร่าง (Draft)" }[key],
              })).map(({ key, label }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{label}</span>
                  <span style={{ fontWeight: 700 }}>{data.byStatus[key]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="em-card">
            <div className="em-card-head"><h3>แยกตามแผนก</h3></div>
            <div className="em-card-body" style={{ padding: 0 }}>
              {data.byDepartment.length === 0 ? (
                <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                  ไม่มีข้อมูลในเดือนนี้
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["แผนก", "ส่ง Memo", "อนุมัติ", "ปฏิเสธ", "งบประมาณรวม (฿)"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: h === "แผนก" ? "left" : "right", fontWeight: 600, fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDepartment.map((row, i) => (
                      <tr key={row.department} style={{ background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                        <td style={{ padding: "9px 14px", fontWeight: 600 }}>{row.department}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right" }}>{row.submitted}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#059669", fontWeight: 600 }}>{row.approved}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#DC2626" }}>{row.rejected}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>
                          {row.budgetTotal.toLocaleString("th-TH", { minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {!fetching && data && data.total === 0 && (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          ไม่มี Memo ในเดือน {formatMonthLabel(month)}
        </div>
      )}
    </main>
  );
}
