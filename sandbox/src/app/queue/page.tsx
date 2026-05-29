"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { formatTimestamp } from "@/lib/format-timestamp";
import { approvalLabels } from "@/lib/approval";
import {
  IconDownload, IconPlus, IconFilter, IconSearch, IconSort,
  IconCrown, IconUsers, IconChevDown, IconCalendar,
  IconDots,
} from "@/components/icons";
import Link from "next/link";
import { DrawerPanel } from "./_components/drawer-panel";

const AVATAR_COLORS = ["#7C3AED", "#2563EB", "#047857", "#B45309", "#BE123C", "#0891B2", "#6D28D9"];
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];

type TabStatus = "all" | "pending" | "approved" | "rejected" | "draft" | "returned";

export default function QueuePage() {
  const { memos, dispatch } = useMemos();
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [isDesktopSplit, setIsDesktopSplit] = useState(false);
  const [isCompactTable, setIsCompactTable] = useState(false);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1280px)");
    const compactMedia = window.matchMedia("(max-width: 1100px)");
    const sync = () => {
      setIsDesktopSplit(desktopMedia.matches);
      setIsCompactTable(compactMedia.matches);
    };
    sync();
    desktopMedia.addEventListener("change", sync);
    compactMedia.addEventListener("change", sync);
    return () => {
      desktopMedia.removeEventListener("change", sync);
      compactMedia.removeEventListener("change", sync);
    };
  }, []);

  const filtered = memos.filter((m) => {
    const matchTab = activeTab === "all" || m.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [m.title, m.id, m.requester, m.department, approvalLabels[m.category]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return matchTab && matchSearch;
  });

  const selectedMemo = memos.find((m) => m.id === selected) ?? null;
  const showInlineDetail = Boolean(selectedMemo) && isDesktopSplit;
  const showOverlayDetail = Boolean(selectedMemo) && !isDesktopSplit;
  const useCompactColumns = showInlineDetail || isCompactTable;

  const counts: Record<TabStatus, number> = {
    all: memos.length,
    pending: memos.filter((m) => m.status === "pending").length,
    approved: memos.filter((m) => m.status === "approved").length,
    rejected: memos.filter((m) => m.status === "rejected").length,
    draft: memos.filter((m) => m.status === "draft").length,
    returned: memos.filter((m) => m.status === "returned").length,
  };

  const stampNow = () => formatTimestamp(new Date());

  const handleAction = (id: string, action: "approve") => {
    if (action === "approve") {
      dispatch({ type: "ADVANCE_STEP", id, updatedAt: stampNow() });
    }
    setSelected(null);
  };

  const handleReject = (id: string, disposition: "close" | "revision-allowed", reason: string) => {
    dispatch({ type: "REJECT_MEMO", id, disposition, reason, updatedAt: stampNow() });
    setSelected(null);
  };

  const handleReturn = (id: string, reason: string) => {
    dispatch({ type: "RETURN_MEMO", id, returnReason: reason, updatedAt: stampNow() });
    setSelected(null);
  };

  const handleResubmit = (id: string, revisionNote?: string) => {
    dispatch({ type: "RESUBMIT_MEMO", id, revisionNote, updatedAt: stampNow() });
    setSelected(null);
  };

  const handleMarkRead = (id: string, recipient: string) => {
    dispatch({ type: "MARK_READ", id, recipient, actedAt: stampNow() });
  };

  const handleSkipAllReads = (id: string, reason: string) => {
    dispatch({ type: "SKIP_ALL_READS", id, skipReason: reason, actedAt: stampNow() });
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
              <button className="em-btn">
                <IconDownload size={15} /> Export
              </button>
              <Link href="/create" className="em-btn primary">
                <IconPlus size={15} /> New Memo
              </Link>
            </>
          }
        />
        <div className="em-content">
          <div className="em-card" style={{ padding: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div className="em-tabs">
                {(["all", "pending", "approved", "rejected", "returned", "draft"] as TabStatus[]).map((t) => (
                  <div
                    key={t}
                    className={`em-tab${activeTab === t ? " active" : ""}`}
                    onClick={() => setActiveTab(t)}
                    style={{ cursor: "pointer" }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}{" "}
                    <span className="count">{counts[t]}</span>
                  </div>
                ))}
              </div>

              <div style={{ width: 1, height: 26, background: "var(--line)" }} />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  border: "1px solid var(--line-2)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  background: "var(--surface)",
                }}
              >
                <IconUsers size={13} style={{ color: "var(--muted)" }} />
                <span style={{ color: "var(--muted)" }}>Tier:</span>
                <strong style={{ color: "var(--ink)" }}>All levels</strong>
                <IconChevDown size={13} style={{ color: "var(--muted)" }} />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  border: "1px solid var(--line-2)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  background: "var(--surface)",
                }}
              >
                <IconCalendar size={13} style={{ color: "var(--muted)" }} />
                <span style={{ color: "var(--muted)" }}>Date:</span>
                <strong style={{ color: "var(--ink)" }}>Last 30 days</strong>
                <IconChevDown size={13} style={{ color: "var(--muted)" }} />
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  border: "1px solid var(--line-2)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  background: "var(--surface-2)",
                }}
              >
                <IconSearch size={13} style={{ color: "var(--muted)" }} />
                <input
                  style={{
                    border: 0,
                    outline: "none",
                    flex: 1,
                    background: "transparent",
                    fontSize: 12.5,
                  }}
                  placeholder="Search memo, owner, amount…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button className="em-btn sm">
                <IconFilter size={13} /> More filters
              </button>
            </div>
          </div>

          <div
            className={showInlineDetail ? "em-queue-split open" : "em-queue-split"}
            style={
              isDesktopSplit
                ? {
                    gridTemplateColumns: showInlineDetail
                      ? "minmax(0,1fr) minmax(420px, 520px)"
                      : "minmax(0,1fr) 0px",
                  }
                : undefined
            }
          >
            <div style={{ minWidth: 0 }}>
              <div className="em-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ width: "100%", overflowX: "hidden" }}>
                  <table className="em-table" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: useCompactColumns ? 112 : 120 }} />
                      <col />
                      {!useCompactColumns && <col style={{ width: 200 }} />}
                      {!useCompactColumns && <col style={{ width: 136 }} />}
                      {!useCompactColumns && <col style={{ width: 156 }} />}
                      <col style={{ width: 104 }} />
                      <col style={{ width: 40 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Memo ID</th>
                        <th>
                          Subject{" "}
                          <IconSort
                            size={11}
                            style={{
                              display: "inline-block",
                              marginLeft: 4,
                              opacity: 0.5,
                            }}
                          />
                        </th>
                        {!useCompactColumns && <th>Requester</th>}
                        {!useCompactColumns && (
                          <th style={{ textAlign: "right", paddingRight: 32 }}>
                            Amount{" "}
                            <IconSort
                              size={11}
                              style={{
                                display: "inline-block",
                                marginLeft: 4,
                                opacity: 0.5,
                              }}
                            />
                          </th>
                        )}
                        {!useCompactColumns && <th>Approver Tier</th>}
                        <th>Status</th>
                        <th style={{ width: 40, textAlign: "right" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((memo) => {
                        const isMd = memo.currentStep === "Managing Director";
                        const initials = memo.requester
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("");
                        return (
                          <tr
                            key={memo.id}
                            className={isMd ? "md-row" : ""}
                            style={
                              selected === memo.id
                                ? { background: "var(--primary-soft)" }
                                : undefined
                            }
                            onClick={() =>
                              setSelected(selected === memo.id ? null : memo.id)
                            }
                          >
                            <td>
                              <span className="em-id">{memo.id}</span>
                            </td>
                            <td style={{ fontWeight: 500 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                }}
                              >
                                {isMd && (
                                  <IconCrown
                                    size={14}
                                    style={{ color: "var(--gold)", flexShrink: 0 }}
                                  />
                                )}
                                <span
                                  style={{
                                    display: "block",
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {memo.title}
                                </span>
                              </div>
                              {!useCompactColumns && isMd && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#7C5E0F",
                                    marginTop: 3,
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Executive route · {memo.routeMode ?? "Book1"}
                                </div>
                              )}
                              {!useCompactColumns &&
                                memo.routeMode === "exception" && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "var(--amber)",
                                      marginTop: 3,
                                      fontWeight: 600,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Route exception · reason captured
                                  </div>
                                )}
                            </td>
                            {!useCompactColumns && (
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: 999,
                                      background: avatarColor(initials),
                                      color: "#fff",
                                      display: "grid",
                                      placeItems: "center",
                                      fontSize: 10,
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {memo.requester}
                                    </div>
                                    <span
                                      className="em-dept"
                                      style={{ display: "inline-flex", marginTop: 2 }}
                                    >
                                      {memo.department}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            )}
                            {!useCompactColumns && (
                              <td
                                className="em-amt"
                                style={{ textAlign: "right", paddingInline: "13px 32px" }}
                              >
                                ฿{memo.amount.toLocaleString()}
                              </td>
                            )}
                            {!useCompactColumns && (
                              <td>
                                <span
                                  className={`em-tier ${
                                    isMd
                                      ? "md"
                                      : memo.currentStep === "General Manager"
                                        ? "gm"
                                        : "mgr"
                                  }`}
                                >
                                  {isMd ? <IconCrown size={11} /> : <IconUsers size={11} />}
                                  {memo.currentStep}
                                </span>
                              </td>
                            )}
                            <td>
                              <span className={`em-pill ${memo.status}`}>
                                <span className="dot" />
                                {memo.status.charAt(0).toUpperCase() + memo.status.slice(1)}
                              </span>
                            </td>
                            <td
                              onClick={(e) => e.stopPropagation()}
                              style={{ textAlign: "right" }}
                            >
                              <IconDots size={15} style={{ color: "var(--muted)" }} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                    borderTop: "1px solid var(--line)",
                    fontSize: 12.5,
                    color: "var(--muted)",
                  }}
                >
                  <div>Showing {filtered.length} of {memos.length} memos</div>
                </div>
              </div>
            </div>

            {isDesktopSplit && (
              <div
                className={
                  showInlineDetail
                    ? "em-queue-detail-shell open"
                    : "em-queue-detail-shell"
                }
                aria-hidden={!showInlineDetail}
              >
                {selectedMemo && (
                  <DrawerPanel
                    key={selectedMemo.id}
                    memo={selectedMemo}
                    onClose={() => setSelected(null)}
                    onAction={handleAction}
                    onReject={handleReject}
                    onReturn={handleReturn}
                    onResubmit={handleResubmit}
                    onMarkRead={handleMarkRead}
                    onSkipAllReads={handleSkipAllReads}
                    inline
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {showOverlayDetail && selectedMemo && (
          <DrawerPanel
            key={selectedMemo.id}
            memo={selectedMemo}
            onClose={() => setSelected(null)}
            onAction={handleAction}
            onReject={handleReject}
            onReturn={handleReturn}
            onResubmit={handleResubmit}
            onMarkRead={handleMarkRead}
            onSkipAllReads={handleSkipAllReads}
          />
        )}
      </div>
    </div>
  );
}
