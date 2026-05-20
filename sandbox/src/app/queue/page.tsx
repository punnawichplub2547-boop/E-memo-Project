"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import { MemoRecord, approvalLabels } from "@/lib/approval";
import {
  IconDownload, IconPlus, IconFilter, IconSearch, IconSort,
  IconCrown, IconUsers, IconChevDown, IconCalendar,
  IconDots, IconCheck, IconX, IconPrinter, IconReturn, IconBell,
} from "@/components/icons";
import Link from "next/link";

const AVATAR_COLORS = ["#7C3AED", "#2563EB", "#047857", "#B45309", "#BE123C", "#0891B2", "#6D28D9"];
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];
const routeSummary = (memo: MemoRecord) =>
  memo.selectedRoute?.join(" -> ") ?? memo.currentStep;

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
    returned: 0,
  };

  const handleAction = (id: string, action: "approve" | "reject") => {
    const updatedAt = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date());
    dispatch({
      type: "UPDATE_STATUS",
      id,
      status: action === "approve" ? "approved" : "rejected",
      updatedAt,
    });
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
                {(["all", "pending", "approved", "rejected", "draft"] as TabStatus[]).map((t) => (
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
                    memo={selectedMemo}
                    onClose={() => setSelected(null)}
                    onAction={handleAction}
                    inline
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {showOverlayDetail && selectedMemo && (
          <DrawerPanel
            memo={selectedMemo}
            onClose={() => setSelected(null)}
            onAction={handleAction}
          />
        )}
      </div>
    </div>
  );
}

function DrawerPanel({
  memo,
  onClose,
  onAction,
  inline = false,
}: {
  memo: MemoRecord;
  onClose: () => void;
  onAction: (id: string, action: "approve" | "reject") => void;
  inline?: boolean;
}) {
  const isMd = memo.currentStep === "Managing Director";
  const createdAt = memo.createdAt ?? memo.updatedAt;

  const wrapperStyle = inline
    ? {
        position: "sticky" as const,
        top: 84,
        alignSelf: "start" as const,
        minWidth: 0,
        maxHeight: "calc(100vh - 108px)",
        display: "flex",
        flexDirection: "column" as const,
      }
    : undefined;

  return (
    <div
      className={inline ? "em-card em-queue-detail-panel" : "em-drawer"}
      style={wrapperStyle}
    >
      <div className="em-drawer-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <span className="em-id" style={{ fontSize: 13 }}>
              {memo.id}
            </span>
            <span className={`em-pill ${memo.status}`}>
              <span className="dot" />
              {memo.status.charAt(0).toUpperCase() + memo.status.slice(1)}
            </span>
            <span
              className={`em-tier ${
                isMd ? "md" : memo.currentStep === "General Manager" ? "gm" : "mgr"
              }`}
            >
              {isMd ? <IconCrown size={11} /> : <IconUsers size={11} />} {memo.currentStep}
            </span>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
            }}
          >
            {memo.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            submitted {createdAt}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button className="em-btn sm ghost icon-only">
            <IconPrinter size={14} />
          </button>
          <button className="em-btn sm ghost icon-only" onClick={onClose}>
            <IconX size={14} />
          </button>
        </div>
      </div>

      <div className="em-drawer-body">

        {/* Description / reason */}
        {memo.description && (
          <section style={{ marginBottom: 0 }}>
            <div className="em-eyebrow" style={{ marginBottom: 6 }}>เหตุผล / Description</div>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              {memo.description}
            </p>
          </section>
        )}

        {/* notifyMD banner */}
        {memo.notifyMD && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, background: "var(--gold-soft)", border: "1px solid rgba(201,168,76,0.40)" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(201,168,76,0.25)", color: "#7C5E0F", display: "grid", placeItems: "center", flexShrink: 0 }}><IconBell size={11} /></div>
            <div style={{ fontSize: 12.5, color: "#5C4708", lineHeight: 1.5 }}>
              <strong style={{ color: "#7C5E0F" }}>แจ้ง MD เพื่อทราบ</strong> — Supplier ปรับราคา (สำเนาถึง MD โดยอัตโนมัติ)
            </div>
          </div>
        )}

        <section>
          <div className="em-eyebrow" style={{ marginBottom: 10 }}>Memo details</div>
          <dl className="em-kv">
            <dt>Requester</dt>
            <dd>{memo.requester}</dd>
            <dt>Department</dt>
            <dd>{memo.department}</dd>
            <dt>Category</dt>
            <dd>{approvalLabels[memo.category]}</dd>
            <dt>Amount</dt>
            <dd className="em-amt" style={{ fontSize: 15 }}>
              ฿{memo.amount.toLocaleString()}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>THB</span>
            </dd>
            {memo.budgetStatus && (
              <>
                <dt>Budget status</dt>
                <dd>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    background: memo.budgetStatus === "in-budget" ? "var(--emerald-soft)" : memo.budgetStatus === "over-budget" ? "var(--amber-soft)" : "var(--rose-soft)",
                    color: memo.budgetStatus === "in-budget" ? "var(--emerald)" : memo.budgetStatus === "over-budget" ? "var(--amber)" : "var(--rose)",
                  }}>
                    {memo.budgetStatus === "in-budget" ? "ในงบประมาณ" : memo.budgetStatus === "over-budget" ? "เกินงบ" : "ไม่มีงบ"}
                  </span>
                </dd>
              </>
            )}
            {memo.accountCode && (
              <>
                <dt>Account code</dt>
                <dd style={{ fontFamily: "monospace", fontSize: 12.5 }}>{memo.accountCode}</dd>
              </>
            )}
            {memo.budgetPlan !== undefined && (
              <>
                <dt>งบประมาณแผน</dt>
                <dd className="em-amt">฿{memo.budgetPlan.toLocaleString()}</dd>
                <dt>ใช้แล้ว / รายการนี้</dt>
                <dd className="em-amt">฿{(memo.budgetUsed ?? 0).toLocaleString()} / ฿{memo.amount.toLocaleString()}</dd>
                <dt>คงเหลือ</dt>
                <dd className="em-amt" style={{ color: (memo.budgetPlan - (memo.budgetUsed ?? 0) - memo.amount) < 0 ? "var(--rose)" : "var(--emerald)", fontWeight: 700 }}>
                  ฿{(memo.budgetPlan - (memo.budgetUsed ?? 0) - memo.amount).toLocaleString()}
                </dd>
              </>
            )}
            <dt>Approver</dt>
            <dd>{memo.currentStep}</dd>
            <dt>Selected route</dt>
            <dd>{routeSummary(memo)}</dd>
            <dt>Workflow state</dt>
            <dd>
              {memo.workflowState ??
                (memo.status === "approved" ? "Approved" : memo.status === "rejected" ? "Rejected" : "Issued")}
            </dd>
            {memo.readRecipients && memo.readRecipients.length > 0 && (
              <>
                <dt>Read by</dt>
                <dd>{memo.readRecipients.join(", ")}</dd>
              </>
            )}
            {memo.routeOverrideReason && (
              <>
                <dt>Exception reason</dt>
                <dd>{memo.routeOverrideReason}</dd>
              </>
            )}
            <dt>Created</dt>
            <dd>{createdAt}</dd>
            <dt>Updated</dt>
            <dd>{memo.updatedAt}</dd>
          </dl>
        </section>

        {/* Price comparison summary */}
        {memo.priceComparisons && memo.priceComparisons.some(r => r.offeredPrice > 0) && (() => {
          const rows = memo.priceComparisons!;
          const selected = rows.find(r => r.id === memo.selectedVendorId) ?? rows[0];
          const validNetPrices = rows.filter(r => r.offeredPrice > 0).map(r => r.netPrice);
          const lowest = Math.min(...validNetPrices);
          const diff = (selected?.netPrice ?? 0) - lowest;
          return (
            <section>
              <div className="em-eyebrow" style={{ marginBottom: 8 }}>Price Comparison</div>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", gap: 6, fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Selected vendor</span>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {selected?.vendorName?.trim() || "—"} · ฿{(selected?.netPrice ?? 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Lowest offer</span>
                  <span style={{ fontWeight: 600, color: "var(--emerald)" }}>฿{lowest.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Difference</span>
                  <span style={{ fontWeight: 700, color: diff > 0 ? "var(--amber)" : "var(--ink)" }}>
                    {diff > 0 ? `+฿${diff.toLocaleString()}` : "฿0"}
                  </span>
                </div>
                {memo.selectedVendorReason && (
                  <div style={{ marginTop: 4, padding: "6px 8px", borderRadius: 6, background: "var(--amber-soft)", color: "#7C5E0F", fontSize: 12 }}>
                    <strong>เหตุผล:</strong> {memo.selectedVendorReason}
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        <hr className="em-divider" />

        <section>
          <div className="em-eyebrow" style={{ marginBottom: 8 }}>Workflow</div>
          <div style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10 }}>
            <strong>Selected route:</strong> {routeSummary(memo)}
            {memo.routeMode === "exception" && (
              <div style={{ color: "var(--amber)", fontWeight: 600, marginTop: 3 }}>
                Exception: {memo.routeOverrideReason}
              </div>
            )}
            {memo.readRecipients && memo.readRecipients.length > 0 && (
              <div style={{ color: "var(--muted)", marginTop: 3 }}>
                Read: {memo.readRecipients.join(", ")}
              </div>
            )}
          </div>
          <div className="em-flow">
            <div className="em-flow-step done">
              <div className="em-flow-dot"><IconCheck size={14} /></div>
              <div>
                <div className="em-flow-title">Requester submitted</div>
                <div className="em-flow-meta">{memo.requester} · {memo.department}</div>
              </div>
            </div>
            {(memo.selectedRoute ?? [memo.currentStep]).map((step, i, arr) => {
              const currentIdx = arr.indexOf(memo.currentStep);
              const isDone = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isMdStep = step === "Managing Director";
              return (
                <div
                  key={step}
                  className={`em-flow-step${isDone ? " done" : isCurrent ? " current" : ""}${isMdStep && isCurrent ? " md" : ""}`}
                >
                  <div className="em-flow-dot">
                    {isDone ? <IconCheck size={14} /> : isMdStep && isCurrent ? <IconCrown size={14} /> : i + 2}
                  </div>
                  <div>
                    <div className="em-flow-title" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {step}
                      {isMdStep && <span className="em-tier md">MD tier</span>}
                    </div>
                    <div className="em-flow-meta">
                      {isDone ? "อนุมัติแล้ว" : isCurrent ? "รอการอนุมัติ" : "รอคิว"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="em-drawer-foot">
        {memo.status === "pending" ? (
          <>
            <button
              className="em-btn danger"
              style={{ flex: 1 }}
              onClick={() => onAction(memo.id, "reject")}
            >
              <IconX size={14} /> Reject
            </button>
            <button className="em-btn" style={{ flex: 1 }} onClick={() => onClose()}>
              <IconReturn size={14} /> Return
            </button>
            <button
              className="em-btn primary"
              style={{ flex: 2 }}
              onClick={() => onAction(memo.id, "approve")}
            >
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
