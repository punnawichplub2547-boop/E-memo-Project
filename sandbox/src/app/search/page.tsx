"use client";

import { useState, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { approvalLabels } from "@/lib/approval";
import {
  IconPlus, IconHistory, IconSparkles, IconSearch,
  IconArrowRight, IconCrown, IconUsers, IconCalendar,
  IconCheckCircle, IconChevDown,
} from "@/components/icons";
import Link from "next/link";

const CATEGORIES = [
  { label: "All categories", key: "all" },
  { label: "ซื้อทั่วไป", key: "general-purchase" },
  { label: "วัตถุดิบ", key: "raw-material" },
  { label: "สัญญา / บริการ", key: "service-contract" },
  { label: "สินทรัพย์ถาวร", key: "fixed-asset" },
  { label: "แม่พิมพ์", key: "mold" },
];

const EXAMPLE_QUERIES = [
  "memo ที่ใช้เวลานานที่สุดเดือนนี้",
  "MD อนุมัติเรื่องไหนบ้างเดือนนี้",
  "งบประมาณการอบรมปี 2025",
  "vendor ที่ใช้บ่อยที่สุด",
];

export default function SearchPage() {
  const { memos } = useMemos();
  const [query, setQuery] = useState("memo ซื้ออุปกรณ์สำนักงาน");
  const [catFilter, setCatFilter] = useState("all");
  const [approvedOnly, setApprovedOnly] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memos.filter(m => {
      const matchCat = catFilter === "all" || m.category === catFilter;
      const matchApproved = !approvedOnly || m.status === "approved";
      const matchQ = !q || [m.title, m.id, m.requester, m.department, approvalLabels[m.category]].join(" ").toLowerCase().includes(q);
      return matchCat && matchApproved && matchQ;
    });
  }, [memos, query, catFilter, approvedOnly]);

  const avgAmount = results.length ? Math.round(results.reduce((s, m) => s + m.amount, 0) / results.length) : 0;
  const approvalRate = results.length ? Math.round(results.filter(m => m.status === "approved").length / results.length * 100) : 0;

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["AI Search"]}
          title="AI Memo Search"
          showSearch={false}
          actions={
            <>
              <button className="em-btn"><IconHistory size={15} /> Saved searches</button>
              <Link href="/create" className="em-btn primary"><IconPlus size={15} /> New Memo</Link>
            </>
          }
        />
        <div className="em-content">

          {/* Hero */}
          <div className="em-hero">
            <div className="em-hero-inner">
              <div className="em-hero-eyebrow"><IconSparkles size={12} /> Powered by AI · Semantic + Keyword</div>
              <h2>ค้นหา memo ย้อนหลังด้วยภาษาธรรมชาติ</h2>
              <p>พิมพ์เลขเอกสาร คำสำคัญ ผู้อนุมัติ หรือคำถามแบบประโยค</p>
              <div className="em-hero-search">
                <IconSearch size={18} style={{ color: "var(--muted)", flexShrink: 0 }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหา memo, ผู้อนุมัติ, แผนก, เลขเอกสาร…" />
                <button className="em-btn primary" style={{ height: 40, padding: "0 18px" }}>Search <IconArrowRight size={14} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
                {EXAMPLE_QUERIES.map(q => (
                  <span key={q} style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(219,234,254,0.9)", border: "1px solid rgba(147,197,253,0.20)", fontSize: 12, fontWeight: 500, cursor: "pointer" }} onClick={() => setQuery(q)}>{q}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="em-eyebrow" style={{ marginRight: 4 }}>Filter</span>
            {CATEGORIES.map(c => (
              <div key={c.key} className={`em-chip${catFilter === c.key ? " active" : ""}`} onClick={() => setCatFilter(c.key)}>
                {c.label}
              </div>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--line)" }} />
            <div className={`em-chip${approvedOnly ? " active" : ""}`} onClick={() => setApprovedOnly(v => !v)}>
              <IconCheckCircle size={12} /> Approved only
            </div>
          </div>

          {/* Results */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Found <strong style={{ color: "var(--ink)" }}>{results.length} results</strong> · sorted by <strong style={{ color: "var(--ink)" }}>relevance</strong>
                </div>
                <div className="em-tabs" style={{ padding: 3 }}>
                  <div className="em-tab active" style={{ padding: "5px 10px", fontSize: 11.5 }}>Relevance</div>
                  <div className="em-tab" style={{ padding: "5px 10px", fontSize: 11.5 }}>Newest</div>
                  <div className="em-tab" style={{ padding: "5px 10px", fontSize: 11.5 }}>Amount</div>
                </div>
              </div>

              {results.length === 0 ? (
                <div className="em-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <IconSearch size={32} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>ไม่พบผลลัพธ์</div>
                  <div style={{ fontSize: 13 }}>ลองเปลี่ยน keyword หรือล้าง filter</div>
                </div>
              ) : (
                results.map(m => {
                  const isMd = m.currentStep === "Managing Director";
                  const initials = m.requester.split(" ").map((p: string) => p[0]).slice(0, 2).join("");
                  return (
                    <article key={m.id} className="em-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span className="em-id" style={{ fontSize: 11.5, background: "var(--primary-grad-soft)", padding: "3px 8px", borderRadius: 5, border: "1px solid var(--primary-soft)" }}>{m.id}</span>
                        <span className={`em-pill ${m.status}`}><span className="dot" />{m.status.charAt(0).toUpperCase() + m.status.slice(1)}</span>
                        <span className={`em-tier ${isMd ? "md" : m.currentStep === "General Manager" ? "gm" : "mgr"}`}>
                          {isMd ? <IconCrown size={11} /> : <IconUsers size={11} />}
                          {isMd ? "MD" : m.currentStep === "General Manager" ? "GM" : "Manager"}
                        </span>
                        <span className="em-dept">{approvalLabels[m.category]}</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                          <IconCalendar size={12} /> {m.updatedAt}
                        </div>
                      </div>
                      <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>{m.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 6, borderTop: "1px dashed var(--line)", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 999, background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{initials}</div>
                          <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{m.requester}</span>
                          <span style={{ color: "var(--muted-2)" }}>·</span>
                          <span style={{ color: "var(--muted)" }}>{m.department}</span>
                        </div>
                        <div style={{ flex: 1 }} />
                        <span className="em-amt">฿{m.amount.toLocaleString()}</span>
                        <button className="em-btn sm ghost">Open <IconArrowRight size={12} /></button>
                      </div>
                    </article>
                  );
                })
              )}

              {results.length > 0 && (
                <button className="em-btn ghost" style={{ alignSelf: "center", marginTop: 4 }}>Load more <IconChevDown size={13} /></button>
              )}
            </div>

            {/* Right rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 22 }}>
              <div className="em-card" style={{ overflow: "hidden", position: "relative" }}>
                <div style={{ height: 3, background: "var(--primary-grad)" }} />
                <div className="em-card-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-grad)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(37,99,235,0.40)" }}>
                      <IconSparkles size={14} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>AI Summary</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{results.length} memos found</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--ink-2)" }}>
                    ผลการค้นหาเฉลี่ยอยู่ที่ <strong>฿{avgAmount.toLocaleString()}</strong> อัตราการอนุมัติ <strong>{approvalRate}%</strong>
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <SummaryStat label="Avg amount" value={`฿${avgAmount.toLocaleString()}`} />
                    <SummaryStat label="Approval rate" value={`${approvalRate}%`} />
                    <SummaryStat label="Results" value={String(results.length)} />
                    <SummaryStat label="MD-tier" value={String(results.filter(m => m.currentStep === "Managing Director").length)} />
                  </div>
                </div>
              </div>

              <div className="em-card">
                <div className="em-card-head">
                  <div>
                    <h3 style={{ fontSize: 13 }}>Try semantic search</h3>
                    <div className="em-sub" style={{ fontSize: 11.5 }}>Example queries</div>
                  </div>
                </div>
                <div className="em-card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                  {EXAMPLE_QUERIES.map(q => (
                    <div key={q} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", cursor: "pointer", fontSize: 12.5, color: "var(--ink-2)" }} onClick={() => setQuery(q)}>
                      <IconSearch size={12} style={{ color: "var(--muted)" }} />
                      <span style={{ flex: 1 }}>{q}</span>
                      <IconArrowRight size={12} style={{ color: "var(--muted-2)" }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{value}</div>
    </div>
  );
}
