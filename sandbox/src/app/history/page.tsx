"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import {
  IconDownload, IconPlus, IconFileText, IconCheckCircle, IconClock,
  IconReturn, IconCrown, IconCheck, IconSlash, IconPen,
  IconArrowRight, IconArrowUp, IconArrowDown, IconCalendar,
  IconUsers, IconChevDown,
} from "@/components/icons";
import { approvalLabels } from "@/lib/approval";
import Link from "next/link";

type HistoryAction = "approved" | "rejected" | "returned" | "submitted" | "draft";
const ACTION_CONFIG: Record<HistoryAction, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  approved:  { icon: <IconCheck size={16} />,       color: "#047857", bg: "#D1FAE5", label: "อนุมัติ" },
  rejected:  { icon: <IconSlash size={16} />,       color: "#BE123C", bg: "#FFE4E6", label: "ปฏิเสธ" },
  returned:  { icon: <IconReturn size={16} />,      color: "#B45309", bg: "#FEF3C7", label: "ส่งกลับ" },
  submitted: { icon: <IconArrowRight size={16} />,  color: "#2563EB", bg: "#DBEAFE", label: "ส่งคำขอ" },
  draft:     { icon: <IconPen size={16} />,         color: "#475569", bg: "#E2E8F0", label: "บันทึกร่าง" },
};

export default function HistoryPage() {
  const { memos } = useMemos();
  const [tabFilter, setTabFilter] = useState<"all" | "approved" | "rejected" | "returned">("all");

  const filtered = memos.filter(m => {
    if (tabFilter === "all") return true;
    return m.status === tabFilter;
  });

  const totalProcessed = memos.length;
  const approvedCount = memos.filter(m => m.status === "approved").length;
  const approvalRate = totalProcessed ? Math.round(approvedCount / totalProcessed * 100) : 0;
  const avgCycle = totalProcessed ? Math.round(memos.reduce((s, m) => s + m.cycleHours, 0) / totalProcessed) : 0;
  const rejectedCount = memos.filter(m => m.status === "rejected").length;
  const mdCount = memos.filter(m => m.currentStep === "Managing Director").length;

  // Group by date label (simplified — group by updatedAt date)
  const groups: { date: string; items: typeof memos }[] = [];
  const seen = new Set<string>();
  filtered.forEach(m => {
    const d = m.updatedAt.split(" ").slice(0, 3).join(" ");
    if (!seen.has(d)) { seen.add(d); groups.push({ date: d, items: [] }); }
    groups[groups.length - 1].items.push(m);
  });

  const managerCount = memos.filter(m => m.currentStep === "Manager / Top Section").length;
  const gmCount = memos.filter(m => m.currentStep === "General Manager").length;

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["History"]}
          title="Memo History & Audit"
          actions={
            <>
              <button className="em-btn"><IconDownload size={15} /> Export CSV</button>
              <Link href="/create" className="em-btn primary"><IconPlus size={15} /> New Memo</Link>
            </>
          }
        />
        <div className="em-content">

          {/* Summary bar */}
          <div className="em-card" style={{ padding: 0, display: "grid", gridTemplateColumns: "repeat(5,1fr)", overflow: "hidden" }}>
            <SummaryBlock label="Total processed" value={String(totalProcessed)} sub="all memos" icon={<IconFileText size={16} />} accent="primary" />
            <SummaryBlock label="Approval rate" value={`${approvalRate}%`} sub={`${approvedCount} of ${totalProcessed}`} icon={<IconCheckCircle size={16} />} accent="emerald" trendDir="up" />
            <SummaryBlock label="Avg. cycle" value={`${avgCycle}h`} sub="target < 24h" icon={<IconClock size={16} />} accent="gold" trendDir="down" />
            <SummaryBlock label="Rejected" value={String(rejectedCount)} sub={`${totalProcessed ? Math.round(rejectedCount/totalProcessed*100) : 0}% rate`} icon={<IconReturn size={16} />} accent="amber" />
            <SummaryBlock label="MD-tier" value={String(mdCount)} sub="executive reviews" icon={<IconCrown size={16} />} accent="md" last />
          </div>

          {/* Filter */}
          <div className="em-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="em-tabs">
              {(["all", "approved", "rejected", "returned"] as const).map(t => (
                <div key={t} className={`em-tab${tabFilter === t ? " active" : ""}`} onClick={() => setTabFilter(t)} style={{ cursor: "pointer" }}>
                  {t === "all" ? "All actions" : t.charAt(0).toUpperCase() + t.slice(1)}
                  <span className="count">{t === "all" ? totalProcessed : t === "approved" ? approvedCount : t === "rejected" ? rejectedCount : 0}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12.5, background: "var(--surface)" }}>
              <IconCalendar size={13} style={{ color: "var(--muted)" }} />
              <span style={{ color: "var(--muted)" }}>Range:</span>
              <strong style={{ color: "var(--ink)" }}>All time</strong>
              <IconChevDown size={13} style={{ color: "var(--muted)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12.5, background: "var(--surface)" }}>
              <IconUsers size={13} style={{ color: "var(--muted)" }} />
              <span style={{ color: "var(--muted)" }}>Actor:</span>
              <strong style={{ color: "var(--ink)" }}>All approvers</strong>
              <IconChevDown size={13} style={{ color: "var(--muted)" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {groups.length === 0 && (
                <div className="em-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>ไม่มีรายการ</div>
                  <div>ยังไม่มี memo ในช่วงเวลานี้</div>
                </div>
              )}
              {groups.map((g, gi) => (
                <div key={gi}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--primary-grad)", boxShadow: "0 0 0 4px rgba(59,130,246,0.20)", flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{g.date}</div>
                    <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                    <span className="em-tier mgr">{g.items.length} actions</span>
                  </div>

                  <div className="em-card" style={{ padding: "4px 0 0", marginTop: 10, position: "relative" }}>
                    {g.items.map((m, i) => {
                      const isMd = m.currentStep === "Managing Director";
                      const action: HistoryAction = m.status === "approved" ? "approved" : m.status === "rejected" ? "rejected" : m.status === "draft" ? "draft" : "submitted";
                      const cfg = ACTION_CONFIG[action];
                      const isLast = i === g.items.length - 1;
                      return (
                        <div key={m.id + i} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 14, padding: "16px 20px", borderBottom: isLast ? 0 : "1px solid var(--line)", background: isMd ? "linear-gradient(90deg,rgba(201,168,76,0.06),transparent 50%)" : "transparent", boxShadow: isMd ? "inset 3px 0 0 var(--gold)" : "none" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, color: cfg.color, display: "grid", placeItems: "center" }}>
                            {cfg.icon}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <span className="em-id" style={{ fontSize: 11.5 }}>{m.id}</span>
                              {isMd && <IconCrown size={13} style={{ color: "var(--gold)" }} />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.title}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ color: "var(--ink-2)", fontWeight: 600 }}>{m.currentStep}</strong>
                              <span>· {cfg.label}</span>
                              <span className="em-amt" style={{ color: "var(--ink-2)" }}>฿{m.amount.toLocaleString()}</span>
                              <span className={`em-tier ${isMd ? "md" : m.currentStep === "General Manager" ? "gm" : "mgr"}`} style={{ height: 18, padding: "0 6px", fontSize: 10 }}>
                                {isMd ? "MD" : m.currentStep === "General Manager" ? "GM" : "Manager"}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{approvalLabels[m.category]}</div>
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--muted-2)", textAlign: "right", whiteSpace: "nowrap" }}>
                            {m.updatedAt}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button className="em-btn ghost" style={{ alignSelf: "center", marginTop: 4 }}>
                Load earlier history <IconChevDown size={13} />
              </button>
            </div>

            {/* Right rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 22 }}>
              <div className="em-card">
                <div className="em-card-head">
                  <div><h3 style={{ fontSize: 13 }}>Action breakdown</h3><div className="em-sub" style={{ fontSize: 11.5 }}>All time</div></div>
                </div>
                <div className="em-card-body" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
                  <BarChart label="Approved" pct={approvalRate} color="#10B981" />
                  <BarChart label="Rejected" pct={totalProcessed ? Math.round(rejectedCount / totalProcessed * 100) : 0} color="#F43F5E" />
                  <BarChart label="Draft" pct={totalProcessed ? Math.round(memos.filter(m => m.status === "draft").length / totalProcessed * 100) : 0} color="#3B82F6" />
                  <BarChart label="Pending" pct={totalProcessed ? Math.round(memos.filter(m => m.status === "pending").length / totalProcessed * 100) : 0} color="#F59E0B" />
                </div>
              </div>

              <div className="em-card">
                <div className="em-card-head">
                  <div><h3 style={{ fontSize: 13 }}>By tier</h3><div className="em-sub" style={{ fontSize: 11.5 }}>Routing distribution</div></div>
                </div>
                <div className="em-card-body" style={{ paddingTop: 4 }}>
                  <TierRow label="Manager" count={managerCount} pct={totalProcessed ? Math.round(managerCount/totalProcessed*100) : 0} color="#2563EB" />
                  <TierRow label="General Manager" count={gmCount} pct={totalProcessed ? Math.round(gmCount/totalProcessed*100) : 0} color="#7C3AED" />
                  <TierRow label="Managing Director" count={mdCount} pct={totalProcessed ? Math.round(mdCount/totalProcessed*100) : 0} color="#C9A84C" md />
                </div>
              </div>

              {mdCount > 0 && (
                <div className="em-card" style={{ background: "linear-gradient(135deg,#FAF1D6 0%,#FFFFFF 60%)", border: "1px solid rgba(201,168,76,0.30)" }}>
                  <div className="em-card-body" style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--gold-grad)", display: "grid", placeItems: "center", color: "#2A1F03", boxShadow: "0 4px 12px rgba(201,168,76,0.30)", flexShrink: 0 }}>
                      <IconCrown size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#7C5E0F" }}>Executive insight</div>
                      <p style={{ fontSize: 12, color: "#5B4408", lineHeight: 1.55, marginTop: 4 }}>
                        เอกสารระดับ MD <strong>{mdCount} ฉบับ</strong> ในระบบ — ตรวจสอบก่อนส่งงวดถัดไป
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({ label, value, sub, icon, accent, trendDir, last }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string; trendDir?: "up" | "down"; last?: boolean }) {
  const accents: Record<string, { bar: string; bg: string; fg: string }> = {
    primary: { bar: "var(--primary-grad)", bg: "var(--primary-soft)", fg: "var(--primary)" },
    emerald: { bar: "linear-gradient(90deg,#047857,#10B981)", bg: "var(--emerald-soft)", fg: "var(--emerald)" },
    gold:    { bar: "var(--gold-grad)", bg: "var(--gold-soft)", fg: "#7C5E0F" },
    amber:   { bar: "linear-gradient(90deg,#D97706,#F59E0B)", bg: "var(--amber-soft)", fg: "var(--amber)" },
    md:      { bar: "var(--gold-grad)", bg: "var(--gold-soft)", fg: "#7C5E0F" },
  };
  const c = accents[accent];
  return (
    <div className={`em-summary-block ${accent}`} style={{ borderRight: last ? 0 : "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, color: c.fg, display: "grid", placeItems: "center" }}>{icon}</div>
        <div className="em-eyebrow" style={{ color: "var(--muted)", letterSpacing: "0.10em" }}>{label}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>{value}</span>
        {trendDir && (
          <span className={`em-trend ${trendDir}`}>
            {trendDir === "up" ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
            {trendDir === "up" ? "+4.2%" : "-3h"}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function BarChart({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--muted)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "var(--surface-soft)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function TierRow({ label, count, pct, color, md }: { label: string; count: number; pct: number; color: string; md?: boolean }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        {md && <IconCrown size={12} style={{ color: "var(--gold)" }} />}
        <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{count} · {pct}%</span>
      </div>
      <div style={{ height: 4, background: "var(--surface-soft)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
