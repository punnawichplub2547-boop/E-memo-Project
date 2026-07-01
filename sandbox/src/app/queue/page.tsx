"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { formatTimestamp } from "@/lib/format-timestamp";
import { ApprovalLevel, approvalLabels } from "@/lib/approval";
import {
  IconPlus, IconSearch, IconSort,
  IconCrown, IconUsers, IconCalendar,
} from "@/components/icons";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DrawerPanel } from "./_components/drawer-panel";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import {
  canApproveMemo,
  canMarkReadRecipient,
  canResubmitMemo,
  canReturnOrRejectMemo,
  canReviewMdMemo,
} from "@/lib/prototype-users";
import { FilterDropdown } from "@/components/filter-dropdown";
import { DATE_OPTIONS, isWithinDays, matchesTier, tierOptions } from "@/lib/memo-filters";

const AVATAR_COLORS = ["#7C3AED", "#2563EB", "#047857", "#B45309", "#BE123C", "#0891B2", "#6D28D9"];
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];

const TIER_STEP_MAP: Record<string, ApprovalLevel> = {
  md:      "Managing Director",
  gm:      "General Manager",
  manager: "Manager / Top Section",
};
const STEP_TIER_LABEL: Record<string, string> = {
  "Managing Director":     "MD Queue",
  "General Manager":       "GM Queue",
  "Manager / Top Section": "Manager Queue",
};

type TabStatus = "all" | "pending" | "approved" | "rejected" | "draft" | "returned";

function QueuePageContent() {
  const { memos, dispatch } = useMemos();
  const { user } = usePrototypeUser();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier") ?? "";
  const memoParam = searchParams.get("memo");
  // `tier` drives both the live list filter AND the executive-view chrome, seeded
  // from the ?tier= URL so executive links pre-select it. Deriving the chrome from
  // the same state keeps the banner/footer label always consistent with the list.
  const [tier, setTier] = useState<string>(() => TIER_STEP_MAP[tierParam] ?? "");
  const [dateDays, setDateDays] = useState("0");
  const now = new Date();
  const activeTierLabel = tier ? STEP_TIER_LABEL[tier] ?? null : null;

  const [activeTab, setActiveTab] = useState<TabStatus>(() => (tier ? "pending" : "all"));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(memoParam);
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

  // Reset the status tab to "pending" when entering a tier view, "all" when leaving.
  useEffect(() => {
    const applyTierDefault = () => setActiveTab(tier ? "pending" : "all");
    applyTierDefault();
  }, [tier]);

  // Open the drawer for a memo deep-linked via ?memo= (e.g. from a notification).
  useEffect(() => {
    const applyMemoParam = () => {
      if (memoParam) setSelected(memoParam);
    };
    applyMemoParam();
  }, [memoParam]);

  const tierMemos = memos.filter((m) => matchesTier(m.currentStep, tier));

  const filtered = tierMemos.filter((m) => {
    const matchTab = activeTab === "all" || m.status === activeTab;
    const matchDate = isWithinDays(m.createdAt, Number(dateDays), now);
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [m.title, m.id, m.requester, m.department, approvalLabels[m.category]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return matchTab && matchDate && matchSearch;
  });

  const selectedMemo = memos.find((m) => m.id === selected) ?? null;
  const showInlineDetail = Boolean(selectedMemo) && isDesktopSplit;
  const showOverlayDetail = Boolean(selectedMemo) && !isDesktopSplit;
  const useCompactColumns = showInlineDetail || isCompactTable;

  const counts: Record<TabStatus, number> = {
    all:      tierMemos.length,
    pending:  tierMemos.filter((m) => m.status === "pending").length,
    approved: tierMemos.filter((m) => m.status === "approved").length,
    rejected: tierMemos.filter((m) => m.status === "rejected").length,
    draft:    tierMemos.filter((m) => m.status === "draft").length,
    returned: tierMemos.filter((m) => m.status === "returned").length,
  };

  const stampNow = () => formatTimestamp(new Date());

  const handleAction = (id: string, action: "approve") => {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !canApproveMemo(user, memo)) return;
    if (action === "approve") {
      dispatch({ type: "ADVANCE_STEP", id, updatedAt: stampNow() });
    }
    setSelected(null);
  };

  const handleReject = (id: string, disposition: "close" | "revision-allowed", reason: string) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !canReturnOrRejectMemo(user, memo)) return;
    dispatch({ type: "REJECT_MEMO", id, disposition, reason, updatedAt: stampNow() });
    setSelected(null);
  };

  const handleReturn = (id: string, reason: string) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !canReturnOrRejectMemo(user, memo)) return;
    dispatch({ type: "RETURN_MEMO", id, returnReason: reason, updatedAt: stampNow() });
    setSelected(null);
  };

  const handleResubmit = (id: string, revisionNote?: string) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !canResubmitMemo(user, memo)) return;
    dispatch({ type: "RESUBMIT_MEMO", id, revisionNote, updatedAt: stampNow() });
    setSelected(null);
  };

  const handleMarkRead = (id: string, recipient: string) => {
    if (!canMarkReadRecipient(user, recipient)) return;
    dispatch({ type: "MARK_READ", id, recipient, actedAt: stampNow() });
  };

  const handleSkipAllReads = (id: string, reason: string) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !canReturnOrRejectMemo(user, memo)) return;
    dispatch({ type: "SKIP_ALL_READS", id, skipReason: reason, actedAt: stampNow() });
  };

  const handleReview = (
    id: string,
    response: "acknowledged_no_objection" | "comment" | "request_revision" | "escalate_to_md_approval",
    comment?: string,
    reason?: string,
  ) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !canReviewMdMemo(user, memo)) return;
    dispatch({ type: "REVIEW_MEMO", id, response, comment, reason, updatedAt: stampNow() });
    setSelected(null);
  };

  return (
    <div className="em-art">
      <Sidebar />
      <div className="em-work" style={{ position: "relative" }}>
        <Topbar
          crumbs={tier ? ["Approval Queue", activeTierLabel!] : ["Approval Queue"]}
          title={tier ? `Executive Review — ${activeTierLabel}` : "Approval Queue"}
          actions={
            <>
              {tier && (
                <Link href="/queue" className="em-btn sm ghost">
                  ← All queues
                </Link>
              )}
              <Link href="/create" className="em-btn primary">
                <IconPlus size={15} /> New Memo
              </Link>
            </>
          }
        />
        <div className="em-content">
          <div className="em-card em-filter-card" style={{ padding: 14 }}>
            <div
              className="em-filter-row"
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

              <div className="em-queue-divider" style={{ width: 1, height: 26, background: "var(--line)" }} />

              <FilterDropdown
                icon={<IconUsers size={13} />}
                label="Tier"
                options={tierOptions("All levels")}
                selected={tier}
                onSelect={setTier}
              />

              <FilterDropdown
                icon={<IconCalendar size={13} />}
                label="Date"
                options={DATE_OPTIONS}
                selected={dateDays}
                onSelect={setDateDays}
              />

              <div
                className="em-queue-search"
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
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={useCompactColumns ? 3 : 6}
                            style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 13 }}
                          >
                            {tier
                              ? `No ${activeTierLabel} memos match the current filters.`
                              : "No memos match the current filters."}
                          </td>
                        </tr>
                      )}
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
                  <div>
                    Showing {filtered.length} of{" "}
                    {tier
                      ? `${tierMemos.length} ${activeTierLabel} memos`
                      : `${memos.length} memos`}
                  </div>
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
                    currentUser={user}
                    onClose={() => setSelected(null)}
                    onAction={handleAction}
                    onReject={handleReject}
                    onReturn={handleReturn}
                    onResubmit={handleResubmit}
                    onMarkRead={handleMarkRead}
                    onSkipAllReads={handleSkipAllReads}
                    onReview={handleReview}
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
            currentUser={user}
            onClose={() => setSelected(null)}
            onAction={handleAction}
            onReject={handleReject}
            onReturn={handleReturn}
            onResubmit={handleResubmit}
            onMarkRead={handleMarkRead}
            onSkipAllReads={handleSkipAllReads}
            onReview={handleReview}
          />
        )}
      </div>
    </div>
  );
}

export default function QueuePage() {
  return (
    <Suspense>
      <QueuePageContent />
    </Suspense>
  );
}
