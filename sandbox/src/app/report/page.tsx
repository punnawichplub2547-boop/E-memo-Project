"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import {
  IconBarChart, IconArrowLeft, IconArrowRight,
  IconFileText, IconCheckCircle, IconClock, IconReturn, IconSlash,
} from "@/components/icons";

const ALLOWED_ROLES = ["admin", "manager", "general-manager", "managing-director"];

type ReportData = {
  month: string;
  total: number;
  byStatus: { pending: number; approved: number; rejected: number; returned: number; draft: number };
  byDepartment: { department: string; submitted: number; approved: number; rejected: number; budgetTotal: number }[];
};

function toMonthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

// Smooth animated counter
function useCounter(target: number, active: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: number;
    if (!active || target === 0) {
      raf = requestAnimationFrame(() => setV(0));
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - (1 - t) ** 3;
      setV(Math.round(target * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setV(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return v;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, color, bg, icon, delay, sub,
}: {
  label: string; value: number; color: string; bg: string;
  icon: React.ReactNode; delay: number; sub?: string;
}) {
  const [active, setActive] = useState(false);
  useEffect(() => { const t = setTimeout(() => setActive(true), delay); return () => clearTimeout(t); }, [delay]);
  const count = useCounter(value, active);

  return (
    <div className="rpt-kpi-card" style={{ "--rpt-accent": color } as React.CSSProperties}>
      <div className="rpt-kpi-icon-wrap" style={{ background: bg, color }}>
        {icon}
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="rpt-kpi-num" style={{ color }}>{count}</div>
        <div className="rpt-kpi-label">{label}</div>
        {sub && <div className="rpt-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const [drawn, setDrawn] = useState(false);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52; const cx = 70; const cy = 70; const circ = 2 * Math.PI * r;

  useEffect(() => { const t = setTimeout(() => setDrawn(true), 250); return () => clearTimeout(t); }, []);

  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
        ไม่มี Memo ในเดือนนี้
      </div>
    );
  }

  // Pure prefix-sum of fractions (start at -0.25 to put the first segment at 12 o'clock);
  // avoids mutating a render-scope variable inside .map().
  const fracs = data.map(d => d.value / total);
  const rotations = fracs.map((_, i) => (fracs.slice(0, i).reduce((s, f) => s + f, -0.25)) * 360);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0, overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2,#F1F5F9)" strokeWidth={22} />
        {data.map((d, i) => {
          const dash = fracs[i] * circ;
          const gap = circ - dash;
          const rot = rotations[i];
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={22} strokeLinecap="butt"
              strokeDasharray={drawn ? `${dash} ${gap}` : `0 ${circ}`}
              transform={`rotate(${rot}, ${cx}, ${cy})`}
              style={{ transition: `stroke-dasharray 0.75s cubic-bezier(0.4,0,0.2,1) ${0.2 + i * 0.13}s` }}
            />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight="800"
          fill="var(--ink,#0F172A)" style={{ fontVariantNumeric: "tabular-nums" }}>{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize={11} fill="var(--muted,#94A3B8)">รายการ</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 120 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink-2,#334155)", flex: 1 }}>{d.label}</span>
            <span style={{ fontWeight: 700, color: d.color, fontVariantNumeric: "tabular-nums" }}>{d.value}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(d.value / total * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart (departments) ───────────────────────────────────────
function DeptBars({ departments, maxVal }: { departments: ReportData["byDepartment"]; maxVal: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 350); return () => clearTimeout(t); }, []);

  if (departments.length === 0) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>ไม่มีข้อมูล</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {departments.slice(0, 10).map((d, i) => {
        const rate = d.submitted ? Math.round(d.approved / d.submitted * 100) : 0;
        const submitPct = maxVal ? d.submitted / maxVal : 0;
        const approvePct = maxVal ? d.approved / maxVal : 0;
        const rateColor = rate >= 90 ? "#059669" : rate >= 70 ? "#D97706" : "#DC2626";
        const rateBg = rate >= 90 ? "#ECFDF5" : rate >= 70 ? "#FFFBEB" : "#FFF1F2";
        return (
          <div key={d.department} className="rpt-dept-row"
            style={{ animationDelay: `${0.35 + i * 0.055}s` }}>
            <span className="rpt-dept-name">{d.department}</span>
            <div style={{ flex: 1, position: "relative", height: 24 }}>
              {/* Background (submitted) */}
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(37,99,235,0.10)", borderRadius: 6,
                width: drawn ? `${submitPct * 100}%` : "0%",
                transition: `width 0.65s cubic-bezier(0.34,1.2,0.64,1) ${0.35 + i * 0.055}s`,
              }} />
              {/* Foreground (approved) */}
              <div style={{
                position: "absolute", top: "25%", left: 0, height: "50%",
                background: "#2563EB", borderRadius: 4,
                width: drawn ? `${approvePct * 100}%` : "0%",
                transition: `width 0.65s cubic-bezier(0.34,1.2,0.64,1) ${0.45 + i * 0.055}s`,
              }} />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums", width: 20, textAlign: "right" }}>
                {d.submitted}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: rateColor, background: rateBg,
                padding: "2px 8px", borderRadius: 20, fontVariantNumeric: "tabular-nums",
              }}>
                {rate}%
              </span>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 16, paddingLeft: 64, marginTop: 2 }}>
        {[
          { bg: "rgba(37,99,235,0.10)", label: "ส่งทั้งหมด" },
          { bg: "#2563EB", label: "อนุมัติแล้ว" },
        ].map(l => (
          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 12, height: 10, borderRadius: 3, background: l.bg, display: "inline-block" }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Approval Rate Gauge ───────────────────────────────────────────────────────
function RateGauge({ rate }: { rate: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 500); return () => clearTimeout(t); }, []);

  const r = 46; const cx = 60; const cy = 64; const circ = 2 * Math.PI * r;
  const pct = drawn ? rate / 100 : 0;
  const dash = pct * circ * 0.75;
  const color = rate >= 80 ? "#059669" : rate >= 60 ? "#D97706" : "#DC2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={120} height={88} viewBox="0 0 120 88" style={{ overflow: "visible" }}>
        {/* Track (270° arc) */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2,#F1F5F9)"
          strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          transform={`rotate(135, ${cx}, ${cy})`} />
        {/* Fill */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(135, ${cx}, ${cy})`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1) 0.5s" }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={26} fontWeight="800"
          fill={color} style={{ fontVariantNumeric: "tabular-nums" }}>
          {rate}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize={13} fill="var(--muted)">%</text>
      </svg>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.4 }}>
        อัตราอนุมัติ<br />
        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>Approval Rate</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [month, setMonth] = useState(() => toMonthParam(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [fetching, setFetching] = useState(false);

  const canAccess = !loading && !!user && user.roles.some(r => ALLOWED_ROLES.includes(r));

  useEffect(() => {
    if (!loading && (!user || !canAccess)) router.replace("/");
  }, [loading, user, canAccess, router]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    // Defer the loading-state reset off the synchronous effect path (runs next frame,
    // well before any network response) to avoid cascading renders.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setFetching(true);
      setData(null);
    });
    fetch(`/api/report?month=${month}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setData(d); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [month, canAccess]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(toMonthParam(new Date(y, m - 1 + delta, 1)));
  };

  if (loading || !canAccess) return null;

  const approvalRate = data && data.total ? Math.round(data.byStatus.approved / data.total * 100) : 0;
  const maxDeptVal = data ? Math.max(...data.byDepartment.map(d => d.submitted), 1) : 1;
  const donutData = data ? [
    { label: "อนุมัติแล้ว", value: data.byStatus.approved, color: "#059669" },
    { label: "รออนุมัติ",   value: data.byStatus.pending,  color: "#7C3AED" },
    { label: "ส่งคืนแก้ไข", value: data.byStatus.returned, color: "#D97706" },
    { label: "ปฏิเสธ",      value: data.byStatus.rejected, color: "#DC2626" },
    { label: "ร่าง",         value: data.byStatus.draft,   color: "#94A3B8" },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["Monthly Report"]}
          title="รายงานประจำเดือน"
          actions={
            <button className="em-btn" onClick={() => router.back()}
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconArrowLeft size={14} /> กลับ
            </button>
          }
        />

        <div className="em-content rpt-page">

          {/* ── Month nav ──────────────────────────────── */}
          <div className="em-card rpt-month-nav">
            <button className="em-btn sm rpt-nav-btn" onClick={() => shiftMonth(-1)}>
              <IconArrowLeft size={13} /> ก่อนหน้า
            </button>
            <div className="rpt-month-center">
              <div className="rpt-month-icon"><IconBarChart size={16} /></div>
              <span className="rpt-month-label">{formatMonthLabel(month)}</span>
            </div>
            <button className="em-btn sm rpt-nav-btn" onClick={() => shiftMonth(1)}>
              ถัดไป <IconArrowRight size={13} />
            </button>
          </div>

          {/* ── Loading ─────────────────────────────────── */}
          {fetching && (
            <div className="rpt-loading">
              <div className="rpt-spinner" />
              <span>กำลังโหลดรายงาน...</span>
            </div>
          )}

          {/* ── Data ────────────────────────────────────── */}
          {data && !fetching && (
            <>
              {/* KPI cards */}
              <div className="rpt-kpi-grid">
                <KpiCard label="E-Memo ทั้งหมด" value={data.total} color="#2563EB" bg="#EFF6FF"
                  icon={<IconFileText size={18} />} delay={0} sub={formatMonthLabel(month)} />
                <KpiCard label="อนุมัติแล้ว" value={data.byStatus.approved} color="#059669" bg="#ECFDF5"
                  icon={<IconCheckCircle size={18} />} delay={70}
                  sub={data.total ? `${approvalRate}% ของทั้งหมด` : undefined} />
                <KpiCard label="รออนุมัติ" value={data.byStatus.pending} color="#7C3AED" bg="#F5F3FF"
                  icon={<IconClock size={18} />} delay={140} />
                <KpiCard label="ส่งคืนแก้ไข" value={data.byStatus.returned} color="#D97706" bg="#FFFBEB"
                  icon={<IconReturn size={18} />} delay={210} />
                <KpiCard label="ปฏิเสธ" value={data.byStatus.rejected} color="#DC2626" bg="#FFF1F2"
                  icon={<IconSlash size={18} />} delay={280} />
              </div>

              {data.total === 0 ? (
                <div className="em-card rpt-empty">
                  <div className="rpt-empty-icon">📊</div>
                  <div className="rpt-empty-title">ไม่มี Memo ในเดือนนี้</div>
                  <div className="rpt-empty-sub">{formatMonthLabel(month)}</div>
                </div>
              ) : (
                <>
                  {/* Charts row */}
                  <div className="rpt-charts-row">
                    <div className="em-card rpt-chart-panel">
                      <div className="em-card-head"><h3>สัดส่วนสถานะ</h3></div>
                      <div className="em-card-body">
                        <DonutChart data={donutData} />
                      </div>
                    </div>

                    <div className="em-card rpt-chart-panel rpt-gauge-panel">
                      <div className="em-card-head"><h3>อัตราอนุมัติ</h3></div>
                      <div className="em-card-body" style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                        <RateGauge rate={approvalRate} />
                      </div>
                    </div>

                    <div className="em-card rpt-chart-panel rpt-dept-chart">
                      <div className="em-card-head">
                        <h3>E-Memo แยกตามแผนก</h3>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>สูงสุด 10 แผนก</span>
                      </div>
                      <div className="em-card-body">
                        <DeptBars departments={data.byDepartment} maxVal={maxDeptVal} />
                      </div>
                    </div>
                  </div>

                  {/* Full department table */}
                  {data.byDepartment.length > 0 && (
                    <div className="em-card">
                      <div className="em-card-head"><h3>รายละเอียดแยกตามแผนก</h3></div>
                      <div style={{ overflowX: "auto" }}>
                        <table className="rpt-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left" }}>แผนก</th>
                              <th>ส่ง Memo</th>
                              <th>อนุมัติ</th>
                              <th>ปฏิเสธ</th>
                              <th>อัตราอนุมัติ</th>
                              <th style={{ textAlign: "right" }}>งบประมาณรวม (฿)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.byDepartment.map((row, i) => {
                              const rate = row.submitted ? Math.round(row.approved / row.submitted * 100) : 0;
                              const rateColor = rate >= 90 ? "#059669" : rate >= 70 ? "#D97706" : "#DC2626";
                              const rateBg = rate >= 90 ? "#ECFDF5" : rate >= 70 ? "#FFFBEB" : "#FFF1F2";
                              return (
                                <tr key={row.department} className="rpt-table-row"
                                  style={{ animationDelay: `${0.45 + i * 0.05}s` }}>
                                  <td style={{ fontWeight: 600 }}>{row.department}</td>
                                  <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{row.submitted}</td>
                                  <td style={{ textAlign: "center", color: "#059669", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{row.approved}</td>
                                  <td style={{ textAlign: "center", color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{row.rejected}</td>
                                  <td style={{ textAlign: "center" }}>
                                    <span style={{
                                      display: "inline-block", padding: "2px 10px", borderRadius: 20,
                                      fontSize: 12, fontWeight: 700, color: rateColor, background: rateBg,
                                      fontVariantNumeric: "tabular-nums",
                                    }}>
                                      {rate}%
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                    {row.budgetTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="rpt-footer-note">
                ข้อมูล ณ {formatMonthLabel(month)} · ต้นแบบ (Prototype)
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
