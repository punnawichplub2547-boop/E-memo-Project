"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useAuth } from "@/lib/auth-context";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { canViewAuditTrail } from "@/lib/audit-access";
import { FilterDropdown } from "@/components/filter-dropdown";
import type { WorkflowAction } from "@/lib/db-memos";
import {
  IconShield, IconCrown, IconFilter, IconCalendar, IconUsers,
  IconFileText, IconArrowLeft, IconArrowRight, IconRefresh, IconSearch,
} from "@/components/icons";

// Bilingual, colour-coded metadata for each workflow action_type.
// Mirrors the DB's canonical action_type set (see lib/audit-query.ts).
const ACTION_META: Record<string, { en: string; th: string; color: string; bg: string }> = {
  submit:              { en: "Submit",    th: "ส่งคำขอ",     color: "#2563EB", bg: "#DBEAFE" },
  save_draft:          { en: "Draft",     th: "บันทึกร่าง",  color: "#475569", bg: "#E2E8F0" },
  check:               { en: "Check",     th: "ตรวจสอบ",     color: "#4338CA", bg: "#EEF2FF" },
  approve:             { en: "Approve",   th: "อนุมัติ",      color: "#047857", bg: "#D1FAE5" },
  return_for_revision: { en: "Return",    th: "ส่งกลับ",      color: "#B45309", bg: "#FEF3C7" },
  reject:              { en: "Reject",    th: "ปฏิเสธ",       color: "#BE123C", bg: "#FFE4E6" },
  read:                { en: "Read",      th: "รับทราบ",      color: "#0E7490", bg: "#CFFAFE" },
  skip_read:           { en: "Skip read", th: "ข้ามรับทราบ",  color: "#64748B", bg: "#F1F5F9" },
  resubmit:            { en: "Resubmit",  th: "ส่งใหม่",      color: "#6D28D9", bg: "#EDE9FE" },
  void:                { en: "Void",      th: "ยกเลิก",       color: "#9F1239", bg: "#FFE4E6" },
  restore:             { en: "Restore",   th: "กู้คืน",       color: "#0F766E", bg: "#CCFBF1" },
};

const AUDIT_ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  ...Object.entries(ACTION_META).map(([value, m]) => ({ value, label: `${m.en} · ${m.th}` })),
];

const PAGE_SIZE = 50;

function ActionBadge({ type }: { type: string }) {
  const m = ACTION_META[type] ?? { en: type, th: "", color: "var(--ink-2)", bg: "var(--surface-2)" };
  return (
    <span
      title={m.th || undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
        background: m.bg, color: m.color, letterSpacing: "0.01em", whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color, flexShrink: 0 }} />
      {m.en}
    </span>
  );
}

export default function AuditTrailPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: protoUser } = usePrototypeUser();

  const roles = authUser ? authUser.roles : protoUser.roles;
  const canView = canViewAuditTrail(roles);

  const [rows, setRows] = useState<WorkflowAction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  // Draft filter inputs vs. applied query (applied only on Apply / Enter).
  const [memo, setMemo] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState({ memo: "", actor: "", action: "", from: "", to: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!canView) return;
    const controller = new AbortController();
    // Defer the loading-state reset off the synchronous effect path (runs next
    // frame, well before any network response) to avoid cascading renders.
    const raf = requestAnimationFrame(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
    });
    const params = new URLSearchParams();
    if (query.memo) params.set("memo", query.memo);
    if (query.actor) params.set("actor", query.actor);
    if (query.action) params.set("action", query.action);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    fetch(`/api/audit?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        setRows(data.rows as WorkflowAction[]);
        setTotal(data.total as number);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError("ไม่สามารถโหลด Audit Trail ได้ — ตรวจสอบการเชื่อมต่อฐานข้อมูล / Failed to load audit trail.");
        setRows([]);
        setTotal(0);
        void err;
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); cancelAnimationFrame(raf); };
  }, [canView, query, page, reloadKey]);

  function applyFilters() {
    setPage(0);
    setQuery({ memo: memo.trim(), actor: actor.trim(), action, from, to });
  }

  function clearFilters() {
    setMemo(""); setActor(""); setAction(""); setFrom(""); setTo("");
    setPage(0);
    setQuery({ memo: "", actor: "", action: "", from: "", to: "" });
  }

  const hasActiveFilters = useMemo(
    () => Boolean(query.memo || query.actor || query.action || query.from || query.to),
    [query],
  );

  const fieldStyle: React.CSSProperties = {
    height: 34, padding: "0 10px", borderRadius: 8,
    border: "1px solid var(--line)", background: "var(--surface)",
    fontSize: 12.5, color: "var(--ink)", outline: "none",
  };

  // ── Access gate (UI). The API is independently gated server-side. ──────────
  if (!authLoading && !canView) {
    return (
      <div className="em-art">
        <Sidebar />
        <div className="em-work">
          <Topbar crumbs={["Audit Trail"]} title="Audit Trail" />
          <div className="em-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
            <div className="em-card" style={{ textAlign: "center", padding: "40px 48px" }}>
              <IconShield size={36} style={{ color: "var(--muted)", marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Access Denied</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                เฉพาะ Managing Director และ Admin เท่านั้น / Managing Director and Admin only.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work">
        <Topbar
          crumbs={["Executive", "Audit Trail"]}
          title="Audit Trail · ประวัติการดำเนินการ"
          actions={
            <button
              className="em-btn"
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={loading}
              title="Refresh"
            >
              <IconRefresh size={15} /> Refresh
            </button>
          }
        />
        <div className="em-content">

          {/* Executive hero band */}
          <div
            className="em-card"
            style={{
              display: "flex", alignItems: "center", gap: 16, padding: "18px 22px",
              background: "linear-gradient(135deg, rgba(201,168,76,0.10) 0%, var(--surface) 55%)",
              border: "1px solid rgba(201,168,76,0.30)",
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: "var(--gold-grad)", display: "grid", placeItems: "center",
              color: "#2A1F03", boxShadow: "0 4px 14px rgba(201,168,76,0.30)",
            }}>
              <IconShield size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                  บันทึกการดำเนินการทุกขั้นตอน
                </h2>
                <span className="em-tier md" style={{ height: 20, padding: "0 8px", fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconCrown size={11} /> Executive
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                ทุก action ของทุก memo (รวม memo ที่ถูกยกเลิก) แบบ read-only เรียงตามเวลาล่าสุด —
                ต่างจากหน้า History ที่แสดงสถานะปัจจุบันเท่านั้น
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {total.toLocaleString()}
              </div>
              <div className="em-eyebrow" style={{ color: "var(--muted)", marginBottom: 0 }}>
                {hasActiveFilters ? "matched records" : "total records"}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="em-card em-filter-card" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                style={{ ...fieldStyle, width: 170, paddingLeft: 28 }}
                placeholder="Memo No. (EM-2026-…)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
              />
            </div>
            <div style={{ position: "relative" }}>
              <IconUsers size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                style={{ ...fieldStyle, width: 160, paddingLeft: 28 }}
                placeholder="ผู้ดำเนินการ / Actor"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
              />
            </div>
            <FilterDropdown
              icon={<IconFilter size={13} />}
              label="Action"
              options={AUDIT_ACTION_OPTIONS}
              selected={action}
              onSelect={setAction}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconCalendar size={13} style={{ color: "var(--muted)" }} />
              <input type="date" style={{ ...fieldStyle, width: 142 }} value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>–</span>
              <input type="date" style={{ ...fieldStyle, width: 142 }} value={to} onChange={(e) => setTo(e.target.value)} title="To" />
            </div>
            <div style={{ flex: 1 }} />
            <button className="em-btn primary" style={{ padding: "7px 16px", fontSize: 12.5 }} onClick={applyFilters}>Apply</button>
            <button className="em-btn" style={{ padding: "7px 14px", fontSize: 12.5 }} onClick={clearFilters} disabled={!hasActiveFilters && !memo && !actor && !action && !from && !to}>Clear</button>
          </div>

          {error && (
            <div className="em-card" style={{ padding: 14, fontSize: 13, color: "#B91C1C", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}

          {/* Trail table */}
          <div className="em-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="em-table" style={{ width: "100%", minWidth: 940, fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>เวลา / Time</th>
                    <th style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>Memo</th>
                    <th style={{ padding: "11px 14px", textAlign: "center", width: 48 }}>Rev</th>
                    <th style={{ padding: "11px 14px" }}>Action</th>
                    <th style={{ padding: "11px 14px" }}>Step</th>
                    <th style={{ padding: "11px 14px" }}>ผู้ดำเนินการ / Actor</th>
                    <th style={{ padding: "11px 14px" }}>Result</th>
                    <th style={{ padding: "11px 16px" }}>เหตุผล / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => (
                    <tr key={`${a.memoNo}-${a.actedAt}-${i}`}>
                      <td style={{ padding: "11px 16px", color: "var(--muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{a.actedAt}</td>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <Link
                          href={`/queue?memo=${encodeURIComponent(a.memoNo)}`}
                          className="em-id"
                          style={{ fontSize: 11.5, textDecoration: "none" }}
                          title="เปิดดู memo นี้"
                        >
                          {a.memoNo}
                        </Link>
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-2)",
                        }}>
                          {a.revisionNo}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px" }}><ActionBadge type={a.actionType} /></td>
                      <td style={{ padding: "11px 14px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>{a.stepLabel ?? "—"}</td>
                      <td style={{ padding: "11px 14px", color: "var(--ink)", whiteSpace: "nowrap" }}>{a.actorName ?? "—"}</td>
                      <td style={{ padding: "11px 14px", color: "var(--muted)", whiteSpace: "nowrap" }}>{a.result ?? "—"}</td>
                      <td
                        style={{ padding: "11px 16px", color: "var(--ink-2)", maxWidth: 280 }}
                        title={a.reason ?? undefined}
                      >
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.reason ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: "44px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        {error ? "—" : hasActiveFilters ? "ไม่พบรายการที่ตรงกับตัวกรอง / No records match the current filters." : "ยังไม่มีรายการ / No audit records yet."}
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={8} style={{ padding: "44px", textAlign: "center", color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
                        กำลังโหลด… / Loading…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {total === 0
                ? "0 records"
                : `แสดง ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} จาก ${total.toLocaleString()}`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="em-btn"
                style={{ padding: "6px 12px", fontSize: 12.5 }}
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <IconArrowLeft size={13} /> Prev
              </button>
              <button
                className="em-btn"
                style={{ padding: "6px 12px", fontSize: 12.5 }}
                disabled={(page + 1) * PAGE_SIZE >= total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <IconArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="em-card" style={{ padding: "12px 16px" }}>
            <div className="em-eyebrow" style={{ color: "var(--muted)", marginBottom: 8 }}>
              <IconFileText size={12} style={{ marginRight: 5, verticalAlign: "-1px" }} />
              ความหมายของ Action / Action legend
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.keys(ACTION_META).map((t) => (
                <ActionBadge key={t} type={t} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
