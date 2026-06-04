"use client";

import { useState, useEffect } from "react";
import type { WorkflowAction } from "@/lib/db-memos";

// Badge config for action_type values written by DB-2 write persistence
const ACTION_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  submit:              { label: "submit",    color: "#2563EB", bg: "#DBEAFE" },
  save_draft:          { label: "draft",     color: "#475569", bg: "#E2E8F0" },
  check:               { label: "check",     color: "#4338CA", bg: "#EEF2FF" },
  approve:             { label: "approve",   color: "#047857", bg: "#D1FAE5" },
  return_for_revision: { label: "return",    color: "#B45309", bg: "#FEF3C7" },
  reject:              { label: "reject",    color: "#BE123C", bg: "#FFE4E6" },
  read:                { label: "read",      color: "#0E7490", bg: "#CFFAFE" },
  skip_read:           { label: "skip read", color: "#64748B", bg: "#F1F5F9" },
  resubmit:            { label: "resubmit",  color: "#6D28D9", bg: "#EDE9FE" },
};

function ActionTypeBadge({ type }: { type: string }) {
  const cfg = ACTION_BADGE[type] ?? { label: type, color: "var(--ink-2)", bg: "var(--surface-2)" };
  return (
    <span style={{
      display: "inline-block",
      fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
      background: cfg.bg, color: cfg.color, letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

export function AuditLogSection({ memoId, refreshKey = "" }: { memoId: string; refreshKey?: string }) {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<WorkflowAction[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Tracks which memo + refresh signal the current actions[] belong to; null = not yet fetched
  const [fetchedForKey, setFetchedForKey] = useState<string | null>(null);

  // Derive loading state and stale-data check in render — no setState at effect body level
  const requestKey = `${memoId}:${refreshKey}`;
  const isLoaded = fetchedForKey === requestKey && !loading;

  // Lazy fetch: only when open AND data is not yet loaded for current memoId.
  // All setState calls live inside doFetch() (async), not at the synchronous effect body level,
  // to satisfy the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (!open || fetchedForKey === requestKey) return;
    let cancelled = false;
    async function doFetch() {
      setLoading(true);
      try {
        const delays = fetchedForKey === null ? [0] : [350, 1200];
        for (const delay of delays) {
          if (delay > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delay));
          }
          if (cancelled) return;
          const resp = await fetch(`/api/memos/${encodeURIComponent(memoId)}/workflow-actions`);
          if (cancelled) return;
          setActions(resp.ok ? (await resp.json()) as WorkflowAction[] : []);
        }
      } catch {
        if (!cancelled) setActions([]);
      } finally {
        if (!cancelled) {
          setFetchedForKey(requestKey);
          setLoading(false);
        }
      }
    }
    // Refetches triggered by MARK_READ / SKIP_ALL_READS can race the fire-and-forget
    // persistence call, so refreshes retry once after a short backoff. First expand
    // still fetches immediately.
    void doFetch();
    return () => {
      cancelled = true;
    };
  }, [open, memoId, requestKey, fetchedForKey]);

  return (
    <section>
      {/* Clearly labelled to distinguish from the Approval Route section above,
          which shows current workflow state derived from in-memory MemoRecord fields.
          This section shows append-only actual events from the workflow_step_actions DB table. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", background: "none", border: "none",
          padding: 0, cursor: "pointer", textAlign: "left",
        }}
      >
        <span className="em-eyebrow" style={{ marginBottom: 0 }}>
          ประวัติการดำเนินการ / Audit Log
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
          {isLoaded && actions !== null && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: "0px 5px", borderRadius: 4,
              background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-2)",
            }}>
              {actions.length}
            </span>
          )}
          <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {loading && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)",
              border: "1px dashed var(--line-2)", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic",
            }}>
              กำลังโหลด...
            </div>
          )}

          {!loading && (actions === null || actions.length === 0) && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)",
              border: "1px dashed var(--line-2)", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic",
            }}>
              ยังไม่มีรายการ (DB อาจไม่พร้อม หรือ memo นี้ยังไม่ถูกบันทึกลง DB)
            </div>
          )}

          {!loading && actions !== null && actions.length > 0 && (
            <div style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden", background: "var(--surface)" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="em-table" style={{ fontSize: 11.5, width: "100%", minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "7px 10px", textAlign: "center", width: 44 }}>Rev</th>
                      <th style={{ padding: "7px 10px" }}>Action</th>
                      <th style={{ padding: "7px 10px" }}>Step</th>
                      <th style={{ padding: "7px 8px" }}>Result</th>
                      <th style={{ padding: "7px 10px" }}>Reason</th>
                      <th style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a, i) => (
                      <tr key={i}>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                            background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-2)",
                          }}>
                            {a.revisionNo}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <ActionTypeBadge type={a.actionType} />
                        </td>
                        <td style={{ padding: "7px 10px", color: "var(--ink-2)" }}>
                          {a.stepLabel ?? "—"}
                        </td>
                        <td style={{ padding: "7px 8px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                          {a.result ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "7px 10px", color: "var(--ink-2)",
                            maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                          title={a.reason ?? undefined}
                        >
                          {a.reason ?? "—"}
                        </td>
                        <td style={{ padding: "7px 10px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {a.actedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
