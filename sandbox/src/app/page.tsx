"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { getDashboardMetrics, approvalLabels } from "@/lib/approval";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { useAuth } from "@/lib/auth-context";
import {
  IconDownload, IconPlus, IconRoute, IconCrown,
  IconSparkles, IconFileText, IconClock, IconCheckCircle, IconRefresh,
  IconArrowUp, IconArrowDown, IconFilter, IconArrowRight,
  IconCheck, IconUsers, IconReturn, IconSlash, IconPen,
} from "@/components/icons";
import Link from "next/link";
import type { MemoRecord } from "@/lib/approval";

// Parses "DD Mon YYYY HH:MM" → ms for sorting.
function parseMemoDate(s: string): number {
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function memoActivity(m: MemoRecord) {
  if (m.status === "approved") return { tone: "emerald", Icon: IconCheckCircle, actor: m.currentStep,  verb: "อนุมัติ" };
  if (m.status === "rejected") return { tone: "rose",    Icon: IconSlash,       actor: m.currentStep,  verb: "ปฏิเสธ" };
  if (m.status === "returned") return { tone: "amber",   Icon: IconReturn,      actor: m.currentStep,  verb: "ส่งกลับ" };
  if (m.status === "pending")  return { tone: "default", Icon: IconArrowRight,  actor: m.requester,    verb: "ส่งคำขอ" };
  return                              { tone: "default", Icon: IconPen,         actor: m.requester,    verb: "บันทึกร่าง" };
}

export default function DashboardPage() {
  const { memos } = useMemos();
  const { user } = usePrototypeUser();
  const { user: authUser, loading: authLoading } = useAuth();
  const metrics = getDashboardMetrics(memos);

  const displayName = authLoading
    ? null
    : authUser
      ? `${authUser.firstName} ${authUser.lastName}`.trim()
      : user.name;

  const canSeeExec = authUser
    ? authUser.roles.includes("admin") || authUser.roles.includes("managing-director")
    : user.roles.includes("admin") || user.roles.includes("managing-director");
  const hasMemos = memos.length > 0;
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setToday(new Date()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const todayLabel = today
    ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(today)
    : " ";
  const mdPendingCount = memos.filter(m => m.status === "pending" && m.currentStep === "Managing Director").length;

  // Workflow Status: most recently updated pending memo.
  const activeMemo = [...memos]
    .filter(m => m.status === "pending")
    .sort((a, b) => parseMemoDate(b.updatedAt) - parseMemoDate(a.updatedAt))[0] ?? null;

  // Recent Activity: one event per memo, sorted by updatedAt desc, top 5.
  const recentActivity = [...memos]
    .sort((a, b) => parseMemoDate(b.updatedAt) - parseMemoDate(a.updatedAt))
    .slice(0, 5);

  // AI Insight: real per-tier cycle averages.
  const tierAvg = (pred: (m: MemoRecord) => boolean) => {
    const sub = memos.filter(pred);
    return sub.length ? Math.round(sub.reduce((s, m) => s + m.cycleHours, 0) / sub.length) : null;
  };
  // Fall back to the current step when a memo has no explicit route so every tier counts
  // seed/legacy memos consistently (not just Manager).
  const memoRouteForTierMetrics = (m: MemoRecord) => m.selectedRoute ?? [m.currentStep];
  const mgrAvg = tierAvg(m => memoRouteForTierMetrics(m).includes("Manager / Top Section"));
  const gmAvg  = tierAvg(m => memoRouteForTierMetrics(m).includes("General Manager"));
  const mdAvg  = tierAvg(m => memoRouteForTierMetrics(m).includes("Managing Director"));
  const overSla = memos.filter(m => m.cycleHours > 24).length;

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
          <div className="em-dash-hero-grid">
            <div className="em-card" style={{ padding: 0, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0A0F1E 0%,#1A2547 65%,#1E3A8A 110%)", color: "#fff", border: "1px solid #060A17" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 100% at 100% 0%,rgba(59,130,246,0.25),transparent 60%),radial-gradient(50% 100% at 0% 100%,rgba(201,168,76,0.10),transparent 60%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", padding: "28px 28px 26px", display: "flex", flexDirection: "column", gap: 20, minHeight: 200, justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#93C5FD", fontWeight: 600 }}>{todayLabel}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    สวัสดีตอนเช้า{displayName ? `, ${displayName}` : ""}
                  </div>
                  <div style={{ fontSize: 13.5, color: "rgba(219,234,254,0.78)", lineHeight: 1.55 }}>
                    มีเอกสาร <strong style={{ color: "#fff" }}>{metrics.pending} ฉบับ</strong> รอการอนุมัติ{mdPendingCount > 0 && <> และ <strong style={{ color: "#E6C76B" }}>{mdPendingCount} ฉบับ</strong> ระดับ MD</>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href="/queue" className="em-btn" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(147,197,253,0.30)", color: "#fff" }}>
                    <IconRoute size={15} /> Review Queue
                  </Link>
                  {canSeeExec && (
                    <Link href="/queue?tier=md" className="em-btn gold"><IconCrown size={15} /> Executive View</Link>
                  )}
                </div>
              </div>
            </div>

            {/* AI Insight — live metrics */}
            <div className="em-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              <div className="em-eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconSparkles size={13} /> AI Insight
              </div>
              {hasMemos ? (
                <>
                  <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.55 }}>
                    Avg. cycle <strong style={{ color: metrics.averageCycleHours > 24 ? "#B45309" : "#047857" }}>{metrics.averageCycleHours}h</strong>
                    {overSla > 0
                      ? <> — <strong style={{ color: "#B45309" }}>{overSla} ฉบับ</strong> เกิน SLA 24h</>
                      : <> — ทุกฉบับอยู่ในเกณฑ์</>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {mgrAvg !== null && <span className="em-tier mgr">Manager {mgrAvg}h</span>}
                    {gmAvg  !== null && <span className="em-tier gm">GM {gmAvg}h</span>}
                    {mdAvg  !== null && <span className="em-tier md">MD {mdAvg}h</span>}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
                  Empty DB Trial Mode พร้อมใช้งาน — ยังไม่มี memo ในฐานข้อมูลจริง สร้างเอกสารฉบับแรกเพื่อเริ่มเก็บสถิติ workflow
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div className="em-dash-kpi-grid">
            <MetricCard label="Total Memo" icon={<IconFileText size={15} />} value={String(metrics.total)} unit="documents" trendDir="up" trendVal="+12.5%" foot="vs last week" />
            <MetricCard label="Pending Approval" tone="amber" icon={<IconClock size={15} />} value={String(metrics.pending)} unit="waiting" trendDir="down" trendVal={`-${metrics.pending}`} foot="2 over SLA" />
            <MetricCard label="Approved" tone="emerald" icon={<IconCheckCircle size={15} />} value={String(metrics.approved)} unit="this cycle" trendDir="up" trendVal="+18%" foot="vs last week" />
            <MetricCard label="Avg. Cycle" tone="gold" icon={<IconRefresh size={15} />} value={String(metrics.averageCycleHours)} unit="hours" trendDir="down" trendVal="-22%" foot="target < 24h" />
          </div>

          {/* Workflow Status + Recent Activity */}
          <div className={`em-dash-work-grid${hasMemos ? "" : " single"}`}>
            {hasMemos ? (
              <>
                {/* Workflow Status — live from most recent pending memo */}
                <div className="em-card">
                  {activeMemo ? (
                    <>
                      <div className="em-card-head">
                        <div>
                          <h3>Workflow Status — {activeMemo.id}</h3>
                          <div className="em-sub">{activeMemo.title} · ฿{activeMemo.amount.toLocaleString()} · {activeMemo.requester}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span className="em-pill pending"><span className="dot" />In Review</span>
                          <Link href="/queue" className="em-btn sm ghost"><IconArrowRight size={13} /> Open</Link>
                        </div>
                      </div>
                      <div className="em-card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
                        <div className="em-flow">
                          <LiveFlow memo={activeMemo} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="em-card-body" style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                      ไม่มีเอกสารที่รอดำเนินการอยู่ในขณะนี้
                    </div>
                  )}
                </div>

                {/* Recent Activity — live from memos */}
                <div className="em-card">
                  <div className="em-card-head">
                    <div>
                      <h3>Recent Activity</h3>
                      <div className="em-sub">เรียงตามวันที่อัปเดตล่าสุด</div>
                    </div>
                    <button className="em-btn sm ghost"><IconRefresh size={13} /></button>
                  </div>
                  <div className="em-card-body" style={{ paddingTop: 4 }}>
                    {recentActivity.map(m => {
                      const { tone, Icon, actor, verb } = memoActivity(m);
                      return (
                        <FeedItem
                          key={m.id}
                          icon={<Icon size={14} />}
                          tone={tone}
                          text={<><strong>{actor}</strong> {verb} <span className="em-id">{m.id}</span> · {approvalLabels[m.category]}</>}
                          time={m.updatedAt}
                        />
                      );
                    })}
                    {recentActivity.length === 0 && (
                      <div style={{ padding: "16px 0", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>ยังไม่มีกิจกรรม</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="em-card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", color: "var(--primary)", background: "var(--primary-soft)", border: "1px solid rgba(37,99,235,0.16)" }}>
                  <IconFileText size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>ยังไม่มี memo ใน Trial DB</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                    โหมดนี้ตั้งใจเริ่มจากฐานข้อมูลว่าง เพื่อให้ข้อมูลที่เห็นเป็นข้อมูลที่ผู้ทดลองสร้างจริงเท่านั้น
                  </div>
                </div>
                <Link href="/create" className="em-btn primary"><IconPlus size={15} /> Create first memo</Link>
              </div>
            )}
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
            <div className="em-table-scroll">
            <table className="em-table">
              <thead>
                <tr>
                  <th>Memo ID</th><th>Subject</th><th>Requester</th><th>Amount</th><th>Approver</th><th>Status</th><th style={{ textAlign: "right" }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {memos.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "38px 20px", color: "var(--muted)", fontSize: 13 }}>
                      ยังไม่มี memo ในฐานข้อมูล — สร้าง memo ใหม่เพื่อเริ่มทดลอง workflow
                    </td>
                  </tr>
                )}
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
    </div>
  );
}

// Renders the workflow timeline for a live pending memo.
function LiveFlow({ memo }: { memo: MemoRecord }) {
  const route = memo.selectedRoute ?? [memo.currentStep];
  const steps: string[] = ["Requester", ...route];
  const currentIdx = steps.indexOf(memo.currentStep);

  return (
    <>
      {steps.map((step, i) => {
        const isDone    = i === 0 || (currentIdx !== -1 && i < currentIdx);
        const isCurrent = i === currentIdx && memo.status === "pending";
        const isMd      = step === "Managing Director";
        const isInRoute = i > 0;

        const who = i === 0
          ? `${memo.requester} · ${memo.department}`
          : isDone
            ? `${step} — อนุมัติแล้ว`
            : isCurrent
              ? `${step} — รอการอนุมัติ`
              : `${step} — ยังไม่ดำเนินการ`;

        const detail = i === 0
          ? `${approvalLabels[memo.category]} · ฿${memo.amount.toLocaleString()}`
          : isDone
            ? "ผ่านการตรวจสอบเรียบร้อย"
            : isCurrent
              ? `ตรวจสอบอยู่ · ${memo.cycleHours}h elapsed`
              : "รอขั้นตอนก่อนหน้าเสร็จสิ้น";

        const time = i === 0 ? memo.createdAt : isDone ? memo.updatedAt : "—";

        return (
          <FlowStep
            key={step + i}
            n={String(i + 1)}
            done={isDone}
            current={isCurrent}
            md={isMd && isInRoute}
            title={i === 0 ? "Requester" : step}
            who={who}
            detail={detail}
            time={time}
          />
        );
      })}
    </>
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
