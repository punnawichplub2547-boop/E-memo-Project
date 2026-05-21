"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { getDashboardMetrics } from "@/lib/approval";
import {
  IconDownload, IconPlus, IconRoute, IconCrown,
  IconSparkles, IconFileText, IconClock, IconCheckCircle, IconRefresh,
  IconArrowUp, IconArrowDown, IconFilter, IconArrowRight,
  IconCheck, IconUsers, IconReturn, IconSlash, IconPen,
} from "@/components/icons";
import Link from "next/link";

export default function DashboardPage() {
  const { memos } = useMemos();
  const metrics = getDashboardMetrics(memos);
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setToday(new Date()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const todayLabel = today
    ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(today)
    : " ";
  const mdPendingCount = memos.filter(m => m.status === "pending" && m.currentStep === "Managing Director").length;

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["Dashboard"]}
          title="Approval Center Overview"
          actions={
            <>
              <button className="em-btn"><IconDownload size={15} /> Export</button>
              <Link href="/create" className="em-btn primary"><IconPlus size={15} /> New Memo</Link>
            </>
          }
        />
        <div className="em-content">

          {/* Hero greeting */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "stretch" }}>
            <div className="em-card" style={{ padding: 0, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0A0F1E 0%,#1A2547 65%,#1E3A8A 110%)", color: "#fff", border: "1px solid #060A17" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 100% at 100% 0%,rgba(59,130,246,0.25),transparent 60%),radial-gradient(50% 100% at 0% 100%,rgba(201,168,76,0.10),transparent 60%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", padding: "28px 28px 26px", display: "flex", flexDirection: "column", gap: 20, minHeight: 200, justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#93C5FD", fontWeight: 600 }}>{todayLabel}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>สวัสดีตอนเช้า, อำภา</div>
                  <div style={{ fontSize: 13.5, color: "rgba(219,234,254,0.78)", lineHeight: 1.55 }}>
                    มีเอกสาร <strong style={{ color: "#fff" }}>{metrics.pending} ฉบับ</strong> รอการอนุมัติ{mdPendingCount > 0 && <> และ <strong style={{ color: "#E6C76B" }}>{mdPendingCount} ฉบับ</strong> ระดับ MD</>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href="/queue" className="em-btn" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(147,197,253,0.30)", color: "#fff" }}>
                    <IconRoute size={15} /> Review Queue
                  </Link>
                  <button className="em-btn gold"><IconCrown size={15} /> Executive View</button>
                </div>
              </div>
            </div>

            <div className="em-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              <div className="em-eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconSparkles size={13} /> AI Insight
              </div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.55 }}>
                Cycle time ลดลง <strong style={{ color: "#047857" }}>18%</strong> จากสัปดาห์ที่แล้ว — เอกสารระดับ GM ใช้เวลาเฉลี่ย <strong>14 ชั่วโมง</strong>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="em-tier mgr">Manager 9h</span>
                <span className="em-tier gm">GM 14h</span>
                <span className="em-tier md">MD 22h</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <MetricCard label="Total Memo" icon={<IconFileText size={15} />} value={String(metrics.total)} unit="documents" trendDir="up" trendVal="+12.5%" foot="vs last week" />
            <MetricCard label="Pending Approval" tone="amber" icon={<IconClock size={15} />} value={String(metrics.pending)} unit="waiting" trendDir="down" trendVal={`-${metrics.pending}`} foot="2 over SLA" />
            <MetricCard label="Approved" tone="emerald" icon={<IconCheckCircle size={15} />} value={String(metrics.approved)} unit="this cycle" trendDir="up" trendVal="+18%" foot="vs last week" />
            <MetricCard label="Avg. Cycle" tone="gold" icon={<IconRefresh size={15} />} value={String(metrics.averageCycleHours)} unit="hours" trendDir="down" trendVal="-22%" foot="target < 24h" />
          </div>

          {/* Workflow + Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>
            <div className="em-card">
              <div className="em-card-head">
                <div>
                  <h3>Workflow Status — EM-2026-008</h3>
                  <div className="em-sub">ค่าใช้จ่ายอบรมผู้ใช้งานระบบ · 18,000 THB · Project Intern</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="em-pill pending"><span className="dot" />In Review</span>
                  <Link href="/queue" className="em-btn sm ghost"><IconArrowRight size={13} /> Open</Link>
                </div>
              </div>
              <div className="em-card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
                <div className="em-flow">
                  <FlowStep n="1" done title="Requester" who="Project Intern · HR&GA IT" detail="Draft submitted with 3 attachments" time="15 May · 09:12" />
                  <FlowStep n="2" done title="Manager / Top Section" who="K. Wirawan · HR&GA" detail="Reviewed budget code 6201-04 and signed off" time="15 May · 13:40" />
                  <FlowStep n="3" current title="General Manager" who="K. Suthep · Operations" detail="ตรวจสอบยอดและขั้นตอนการเบิก — ตอบกลับภายใน 4 ชม." time="Now · 16h elapsed" />
                  <FlowStep n="4" md title="Managing Director" who="K. Pichet · MD Office" detail="ไม่ต้องอนุมัติ (ภายใต้ 50,000 THB และในงบประมาณ)" time="—" skipped />
                </div>
              </div>
            </div>

            <div className="em-card">
              <div className="em-card-head">
                <div>
                  <h3>Recent Activity</h3>
                  <div className="em-sub">Live updates</div>
                </div>
                <button className="em-btn sm ghost"><IconRefresh size={13} /></button>
              </div>
              <div className="em-card-body" style={{ paddingTop: 4 }}>
                <FeedItem icon={<IconCheckCircle size={14} />} tone="emerald" text={<><strong>K. Suthep</strong> approved <span className="em-id">EM-2026-003</span></>} time="3 min ago" />
                <FeedItem icon={<IconCrown size={14} />} tone="gold" text={<><strong>K. Pichet (MD)</strong> requested review on <span className="em-id">EM-2026-006</span></>} time="22 min ago" />
                <FeedItem icon={<IconPen size={14} />} tone="default" text={<><strong>Production</strong> created <span className="em-id">EM-2026-009</span> · 48,200 THB</>} time="1h ago" />
                <FeedItem icon={<IconReturn size={14} />} tone="amber" text={<><strong>K. Wirawan</strong> returned <span className="em-id">EM-2026-007</span> for budget clarification</>} time="2h ago" />
                <FeedItem icon={<IconSlash size={14} />} tone="rose" text={<><strong>K. Pichet</strong> rejected <span className="em-id">EM-2026-006</span></>} time="5h ago" />
              </div>
            </div>
          </div>

          {/* Queue preview */}
          <div className="em-card">
            <div className="em-card-head">
              <div>
                <h3>Approval Queue</h3>
                <div className="em-sub">รายการเอกสารที่ต้องติดตามและอนุมัติ · {memos.length} active</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="em-btn sm ghost"><IconFilter size={13} /> Filter</button>
                <Link href="/queue" className="em-btn sm">View all <IconArrowRight size={13} /></Link>
              </div>
            </div>
            <table className="em-table">
              <thead>
                <tr>
                  <th>Memo ID</th><th>Subject</th><th>Requester</th><th>Amount</th><th>Approver</th><th>Status</th><th style={{ textAlign: "right" }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {memos.slice(0, 6).map((m) => {
                  const isMd = m.currentStep === "Managing Director";
                  return (
                    <tr key={m.id} className={isMd ? "md-row" : ""}>
                      <td><span className="em-id">{m.id}</span></td>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isMd && <IconCrown size={14} style={{ color: "var(--gold)" }} />}
                          {m.title}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{m.requester}</span>
                          <span className="em-dept" style={{ alignSelf: "flex-start", marginTop: 3 }}>{m.department}</span>
                        </div>
                      </td>
                      <td className="em-amt">฿{m.amount.toLocaleString()}</td>
                      <td>
                        <span className={`em-tier ${isMd ? "md" : m.currentStep === "General Manager" ? "gm" : "mgr"}`}>
                          {isMd ? <IconCrown size={11} /> : <IconUsers size={11} />}
                          {m.currentStep}
                        </span>
                      </td>
                      <td><span className={`em-pill ${m.status}`}><span className="dot" />{m.status.charAt(0).toUpperCase() + m.status.slice(1)}</span></td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 12 }}>{m.updatedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, trendDir, trendVal, foot, tone }: { label: string; value: string; unit: string; icon: React.ReactNode; trendDir: "up" | "down"; trendVal: string; foot: string; tone?: string }) {
  return (
    <div className={`em-metric${tone ? " " + tone : ""}`}>
      <div className="em-metric-label">
        <div className="em-mi">{icon}</div>
        {label}
      </div>
      <div className="em-metric-value">{value}<span className="em-metric-unit">{unit}</span></div>
      <div className="em-metric-foot">
        <span className={`em-trend ${trendDir}`}>
          {trendDir === "up" ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
          {trendVal}
        </span>
        <span>{foot}</span>
      </div>
    </div>
  );
}

function FlowStep({ n, title, who, detail, time, done, current, md, skipped }: { n: string; title: string; who: string; detail: string; time: string; done?: boolean; current?: boolean; md?: boolean; skipped?: boolean }) {
  return (
    <div className={`em-flow-step${done ? " done" : ""}${current ? " current" : ""}${md ? " md" : ""}`}>
      <div className="em-flow-dot">
        {done ? <IconCheck size={14} /> : md ? <IconCrown size={14} /> : skipped ? "–" : n}
      </div>
      <div>
        <div className="em-flow-title">
          {title}
          {md && <span className="em-tier md" style={{ marginLeft: 2 }}>MD tier</span>}
          {skipped && <span className="em-tier" style={{ marginLeft: 2, background: "var(--slate-soft)", color: "var(--muted)", border: 0 }}>skipped</span>}
        </div>
        <div className="em-flow-meta"><strong style={{ color: "var(--ink-2)", fontWeight: 600 }}>{who}</strong> · {detail}</div>
      </div>
      <div className="em-flow-time">{time}</div>
    </div>
  );
}

function FeedItem({ icon, tone, text, time }: { icon: React.ReactNode; tone: string; text: React.ReactNode; time: string }) {
  return (
    <div className="em-feed-item">
      <div className={`em-feed-icon${tone && tone !== "default" ? " " + tone : ""}`}>{icon}</div>
      <div>
        <div className="em-feed-text">{text}</div>
        <div className="em-feed-time">{time}</div>
      </div>
    </div>
  );
}
