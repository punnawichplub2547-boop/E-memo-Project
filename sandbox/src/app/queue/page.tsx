"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { MemoRecord, approvalLabels } from "@/lib/approval";
import {
  IconDownload, IconPlus, IconFilter, IconSearch, IconSort,
  IconCrown, IconUsers, IconChevDown, IconCalendar,
  IconDots, IconCheck, IconX, IconPrinter, IconReturn,
} from "@/components/icons";
import Link from "next/link";

const AVATAR_COLORS = ["#7C3AED", "#2563EB", "#047857", "#B45309", "#BE123C", "#0891B2", "#6D28D9"];
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];

type TabStatus = "all" | "pending" | "approved" | "rejected" | "draft" | "returned";

export default function QueuePage() {
  const { memos, dispatch } = useMemos();
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = memos.filter(m => {
    const matchTab = activeTab === "all" || m.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch = !q || [m.title, m.id, m.requester, m.department, approvalLabels[m.category]].join(" ").toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const selectedMemo = memos.find(m => m.id === selected) ?? null;

  const counts: Record<TabStatus, number> = {
    all: memos.length,
    pending: memos.filter(m => m.status === "pending").length,
    approved: memos.filter(m => m.status === "approved").length,
    rejected: memos.filter(m => m.status === "rejected").length,
    draft: memos.filter(m => m.status === "draft").length,
    returned: 0,
  };

  const handleAction = (id: string, action: "approve" | "reject") => {
    dispatch({ type: "UPDATE_STATUS", id, status: action === "approve" ? "approved" : "rejected" });
    setSelected(null);
  };

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work" style={{ position: "relative" }}>
        <Topbar
          crumbs={["Approval Queue"]}
          title="Approval Queue"
          actions={
            <>
              <button className="em-btn"><IconDownload size={15} /> Export</button>
              <Link href="/create" className="em-btn primary"><IconPlus size={15} /> New Memo</Link>
            </>
          }
        />
        <div className="em-content" style={{ paddingRight: selected ? 506 : undefined }}>

          {/* Filter bar */}
          <div className="em-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="em-tabs">
                {(["all", "pending", "approved", "rejected", "draft"] as TabStatus[]).map(t => (
                  <div key={t} className={`em-tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)} style={{ cursor: "pointer" }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)} <span className="count">{counts[t]}</span>
                  </div>
                ))}
              </div>

              <div style={{ width: 1, height: 26, background: "var(--line)" }} />

              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12.5, background: "var(--surface)" }}>
                <IconUsers size={13} style={{ color: "var(--muted)" }} />
                <span style={{ color: "var(--muted)" }}>Tier:</span>
                <strong style={{ color: "var(--ink)" }}>All levels</strong>
                <IconChevDown size={13} style={{ color: "var(--muted)" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12.5, background: "var(--surface)" }}>
                <IconCalendar size={13} style={{ color: "var(--muted)" }} />
                <span style={{ color: "var(--muted)" }}>Date:</span>
                <strong style={{ color: "var(--ink)" }}>Last 30 days</strong>
                <IconChevDown size={13} style={{ color: "var(--muted)" }} />
              </div>

              <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12.5, background: "var(--surface-2)" }}>
                <IconSearch size={13} style={{ color: "var(--muted)" }} />
                <input style={{ border: 0, outline: "none", flex: 1, background: "transparent", fontSize: 12.5 }} placeholder="Search memo, owner, amount…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <button className="em-btn sm"><IconFilter size={13} /> More filters</button>
            </div>
          </div>

          {/* Table */}
          <div className="em-card" style={{ padding: 0 }}>
            <table className="em-table">
              <thead>
                <tr>
                  <th>Memo ID</th>
                  <th style={{ minWidth: 260 }}>Subject <IconSort size={11} style={{ display: "inline-block", marginLeft: 4, opacity: 0.5 }} /></th>
                  <th>Requester</th>
                  <th style={{ textAlign: "right" }}>Amount <IconSort size={11} style={{ display: "inline-block", marginLeft: 4, opacity: 0.5 }} /></th>
                  <th>Approver Tier</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Updated</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isMd = r.currentStep === "Managing Director";
                  const initials = r.requester.split(" ").map((p: string) => p[0]).slice(0, 2).join("");
                  return (
                    <tr key={r.id} className={isMd ? "md-row" : ""} style={selected === r.id ? { background: "var(--primary-soft)" } : undefined} onClick={() => setSelected(selected === r.id ? null : r.id)}>
                      <td><span className="em-id">{r.id}</span></td>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isMd && <IconCrown size={14} style={{ color: "var(--gold)" }} />}
                          <span>{r.title}</span>
                        </div>
                        {isMd && <div style={{ fontSize: 11, color: "#7C5E0F", marginTop: 3, fontWeight: 600 }}>Executive tier · &gt;50,000 THB</div>}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 999, background: avatarColor(initials), color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                          <div>
                            <div style={{ fontSize: 12.5 }}>{r.requester}</div>
                            <span className="em-dept" style={{ display: "inline-flex", marginTop: 2 }}>{r.department}</span>
                          </div>
                        </div>
                      </td>
                      <td className="em-amt" style={{ textAlign: "right" }}>฿{r.amount.toLocaleString()}</td>
                      <td>
                        <span className={`em-tier ${isMd ? "md" : r.currentStep === "General Manager" ? "gm" : "mgr"}`}>
                          {isMd ? <IconCrown size={11} /> : <IconUsers size={11} />}
                          {r.currentStep}
                        </span>
                      </td>
                      <td><span className={`em-pill ${r.status}`}><span className="dot" />{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 12 }}>{r.updatedAt}</td>
                      <td onClick={e => e.stopPropagation()}><IconDots size={15} style={{ color: "var(--muted)" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--muted)" }}>
              <div>Showing {filtered.length} of {memos.length} memos</div>
            </div>
          </div>
        </div>

        {/* Drawer */}
        {selectedMemo && (
          <DrawerPanel memo={selectedMemo} onClose={() => setSelected(null)} onAction={handleAction} />
        )}
      </div>
    </div>
  );
}

function DrawerPanel({ memo, onClose, onAction }: { memo: MemoRecord; onClose: () => void; onAction: (id: string, action: "approve" | "reject") => void }) {
  const isMd = memo.currentStep === "Managing Director";
  return (
    <div className="em-drawer">
      <div className="em-drawer-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span className="em-id" style={{ fontSize: 13 }}>{memo.id}</span>
            <span className={`em-pill ${memo.status}`}><span className="dot" />{memo.status.charAt(0).toUpperCase() + memo.status.slice(1)}</span>
            <span className={`em-tier ${isMd ? "md" : memo.currentStep === "General Manager" ? "gm" : "mgr"}`}>
              {isMd ? <IconCrown size={11} /> : <IconUsers size={11} />} {memo.currentStep}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{memo.title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>submitted {memo.updatedAt}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="em-btn sm ghost icon-only"><IconPrinter size={14} /></button>
          <button className="em-btn sm ghost icon-only" onClick={onClose}><IconX size={14} /></button>
        </div>
      </div>

      <div className="em-drawer-body">
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 10 }}>Memo details</div>
          <dl className="em-kv">
            <dt>Requester</dt><dd>{memo.requester}</dd>
            <dt>Department</dt><dd>{memo.department}</dd>
            <dt>Category</dt><dd>{approvalLabels[memo.category]}</dd>
            <dt>Amount</dt><dd className="em-amt" style={{ fontSize: 15 }}>฿{memo.amount.toLocaleString()} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>THB</span></dd>
            <dt>Approver</dt><dd>{memo.currentStep}</dd>
            <dt>Updated</dt><dd>{memo.updatedAt}</dd>
          </dl>
        </section>
        <hr className="em-divider" />
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 8 }}>Workflow</div>
          <div className="em-flow">
            <div className={`em-flow-step done`}>
              <div className="em-flow-dot"><IconCheck size={14} /></div>
              <div>
                <div className="em-flow-title">Requester submitted</div>
                <div className="em-flow-meta">{memo.requester} · {memo.department}</div>
              </div>
            </div>
            <div className={`em-flow-step${memo.currentStep === "General Manager" || memo.currentStep === "Managing Director" ? " done" : " current"}`}>
              <div className="em-flow-dot">
                {memo.currentStep !== "Manager / Top Section" ? <IconCheck size={14} /> : "2"}
              </div>
              <div>
                <div className="em-flow-title">Manager / Top Section</div>
                <div className="em-flow-meta">Budget and document review</div>
              </div>
            </div>
            <div className={`em-flow-step${memo.currentStep === "Managing Director" ? " done" : memo.currentStep === "General Manager" ? " current" : ""}`}>
              <div className="em-flow-dot">
                {memo.currentStep === "Managing Director" ? <IconCheck size={14} /> : memo.currentStep === "General Manager" ? "3" : "3"}
              </div>
              <div>
                <div className="em-flow-title">General Manager</div>
                <div className="em-flow-meta">Amount threshold approval</div>
              </div>
            </div>
            <div className={`em-flow-step${memo.currentStep === "Managing Director" ? " current md" : ""}`}>
              <div className="em-flow-dot">{memo.currentStep === "Managing Director" ? <IconCrown size={14} /> : "4"}</div>
              <div>
                <div className="em-flow-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>Managing Director <span className="em-tier md">MD tier</span></div>
                <div className="em-flow-meta">Required for MD-level rules</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="em-drawer-foot">
        {memo.status === "pending" ? (
          <>
            <button className="em-btn danger" style={{ flex: 1 }} onClick={() => onAction(memo.id, "reject")}>
              <IconX size={14} /> Reject
            </button>
            <button className="em-btn" style={{ flex: 1 }} onClick={() => onClose()}>
              <IconReturn size={14} /> Return
            </button>
            <button className="em-btn primary" style={{ flex: 2 }} onClick={() => onAction(memo.id, "approve")}>
              <IconCheck size={14} /> Approve
            </button>
          </>
        ) : (
          <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            This memo has been <strong>{memo.status}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
