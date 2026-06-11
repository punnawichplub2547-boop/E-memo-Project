"use client";

import React from "react";
import { MemoRecord, approvalLabels, computePriceRowTotals } from "@/lib/approval";
import {
  IconCrown, IconUsers, IconBell, IconCheck,
  IconPrinter, IconX, IconReturn, IconPen,
} from "@/components/icons";
import { DrawerFooter } from "./drawer-footer";
import { AuditLogSection } from "./audit-log-section";
import { canMarkReadRecipient, type PrototypeUser } from "@/lib/prototype-users";
import { formatAttachmentSize } from "@/lib/attachments";

const routeSummary = (memo: MemoRecord) =>
  memo.selectedRoute?.join(" -> ") ?? memo.currentStep;

export function DrawerPanel({
  memo,
  currentUser,
  onClose,
  onAction,
  onReject,
  onReturn,
  onResubmit,
  onMarkRead,
  onSkipAllReads,
  inline = false,
}: {
  memo: MemoRecord;
  currentUser: PrototypeUser;
  onClose: () => void;
  onAction: (id: string, action: "approve") => void;
  onReject: (id: string, disposition: "close" | "revision-allowed", reason: string) => void;
  onReturn: (id: string, reason: string) => void;
  onResubmit: (id: string, revisionNote?: string) => void;
  onMarkRead: (id: string, recipient: string) => void;
  onSkipAllReads: (id: string, reason: string) => void;
  inline?: boolean;
}) {
  const isMd = memo.currentStep === "Managing Director";
  const createdAt = memo.createdAt ?? memo.updatedAt;
  const readStepOffset = memo.readActions?.length ?? 0;
  const auditRefreshKey = [
    memo.updatedAt,
    memo.status,
    memo.currentStep,
    memo.revisionNo ?? 0,
    memo.readActions
      ?.map((ra) => `${ra.recipient}:${ra.status}:${ra.actedAt ?? ""}:${ra.skipReason ?? ""}`)
      .join("|") ?? "",
  ].join("::");

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
            {(memo.revisionNo ?? 0) > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--line)", letterSpacing: "0.02em" }}>
                Rev.{memo.revisionNo}
              </span>
            )}
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
          {memo.returnReason && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "var(--amber-soft)", border: "1px solid rgba(180,83,9,0.22)", fontSize: 12, color: "var(--amber)", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <IconReturn size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>{memo.status === "returned" ? "ส่งกลับ:" : "เหตุผลที่เคยส่งกลับ:"}</strong>{" "}
                {memo.returnReason}
              </span>
            </div>
          )}
          {memo.revisionNote && (
            <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "var(--emerald-soft, #D1FAE5)", border: "1px solid rgba(4,120,87,0.22)", fontSize: 12, color: "#047857", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <IconPen size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>หมายเหตุการแก้ไข:</strong> {memo.revisionNote}</span>
            </div>
          )}
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

        {/* 2. Request Summary card — compact metadata at a glance */}
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 8 }}>Request Summary</div>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            <SummaryRow label="Requester" value={memo.requester} />
            <SummaryRow label="Department" value={memo.department} />
            <SummaryRow label="Category" value={approvalLabels[memo.category]} />
            <SummaryRow
              label="Amount"
              value={
                <span className="em-amt" style={{ fontSize: 14 }}>
                  ฿{memo.amount.toLocaleString()}
                  <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11, marginLeft: 4 }}>THB</span>
                </span>
              }
            />
            <SummaryRow
              label="Budget"
              value={
                memo.budgetStatus ? (
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    background: memo.budgetStatus === "in-budget" ? "var(--emerald-soft)" : memo.budgetStatus === "over-budget" ? "var(--amber-soft)" : "var(--rose-soft)",
                    color: memo.budgetStatus === "in-budget" ? "var(--emerald)" : memo.budgetStatus === "over-budget" ? "var(--amber)" : "var(--rose)",
                  }}>
                    {memo.budgetStatus === "in-budget" ? "ในงบประมาณ" : memo.budgetStatus === "over-budget" ? "เกินงบ" : "ไม่มีงบ"}
                  </span>
                ) : <span style={{ color: "var(--muted)" }}>—</span>
              }
            />
            <SummaryRow
              label="Current step"
              value={
                <span className={`em-tier ${isMd ? "md" : memo.currentStep === "General Manager" ? "gm" : "mgr"}`} style={{ fontSize: 11 }}>
                  {isMd ? <IconCrown size={10} /> : <IconUsers size={10} />}
                  {memo.currentStep}
                </span>
              }
            />
          </div>
        </section>

        {/* 3. Description / เหตุผลการขอ */}
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 6 }}>เหตุผลการขอ / Description</div>
          {memo.description ? (
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", margin: 0, padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>
              {memo.description}
            </p>
          ) : (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px dashed var(--line-2)", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
              ไม่มีรายละเอียดประกอบเพิ่มเติม
            </div>
          )}
        </section>

        {/* 4. Closing Remark / หมายเหตุ */}
        {memo.closingRemark && (
          <section>
            <div className="em-eyebrow" style={{ marginBottom: 6 }}>หมายเหตุ / Closing Remark</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", margin: 0, padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>
              {memo.closingRemark}
            </p>
          </section>
        )}

        {/* 5. Request items */}
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 8 }}>รายการที่ขออนุมัติ / Request Items</div>
          {memo.requestItems && memo.requestItems.some(r => r.name.trim() || r.unitPrice > 0) ? (() => {
            const items = memo.requestItems!.filter(r => r.name.trim() || r.unitPrice > 0);
            const total = items.reduce((sum, r) => sum + Math.round(r.qty * r.unitPrice), 0);
            return (
              <div style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden", background: "var(--surface)" }}>
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                  <table className="em-table" style={{ fontSize: 12, tableLayout: "fixed", width: "100%", minWidth: 360 }}>
                    <colgroup>
                      <col />
                      <col style={{ width: 64 }} />
                      <col style={{ width: 92 }} />
                      <col style={{ width: 92 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ padding: "8px 12px" }}>รายการ</th>
                        <th style={{ textAlign: "center", padding: "8px 6px" }}>จำนวน</th>
                        <th style={{ textAlign: "right", padding: "8px 8px" }}>ราคา/หน่วย</th>
                        <th style={{ textAlign: "right", padding: "8px 12px" }}>รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(r => (
                        <tr key={r.id}>
                          <td style={{ padding: "8px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", color: "var(--ink-2)" }}>{r.qty} {r.unit}</td>
                          <td style={{ padding: "8px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>฿{r.unitPrice.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>฿{Math.round(r.qty * r.unitPrice).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--line)", background: "var(--surface-2)" }}>
                        <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ยอดรวม</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>฿{total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })() : (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px dashed var(--line-2)", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
              ไม่มีรายการสินค้า / บริการที่ระบุ
            </div>
          )}
        </section>

        {/* 5. Budget Summary */}
        {(memo.budgetStatus || memo.accountCode || memo.budgetPlan !== undefined) && (
          <section>
            <div className="em-eyebrow" style={{ marginBottom: 8 }}>Budget Summary / สรุปงบประมาณ</div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", gap: 8, fontSize: 12.5 }}>
              {memo.accountCode && (
                <BudgetRow label="Account code" value={<span style={{ fontFamily: "monospace", fontSize: 12 }}>{memo.accountCode}</span>} />
              )}
              {memo.budgetPlan !== undefined && (
                <>
                  <BudgetRow label="Budget plan" value={<span className="em-amt" style={{ fontSize: 13 }}>฿{memo.budgetPlan.toLocaleString()}</span>} />
                  <BudgetRow label="Used to date" value={<span className="em-amt" style={{ fontSize: 13 }}>฿{(memo.budgetUsed ?? 0).toLocaleString()}</span>} />
                  <BudgetRow label="This request" value={<span className="em-amt" style={{ fontSize: 13 }}>฿{memo.amount.toLocaleString()}</span>} />
                  {(() => {
                    const remaining = memo.budgetPlan - (memo.budgetUsed ?? 0) - memo.amount;
                    const neg = remaining < 0;
                    return (
                      <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px dashed var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.04em" }}>คงเหลือ / Remaining</span>
                        <span className="em-amt" style={{ fontSize: 14, fontWeight: 700, color: neg ? "var(--rose)" : "var(--emerald)" }}>
                          {neg ? "-" : ""}฿{Math.abs(remaining).toLocaleString()}
                        </span>
                      </div>
                    );
                  })()}
                </>
              )}
              {memo.budgetPlan === undefined && memo.budgetStatus && (
                <div style={{ color: "var(--muted)", fontStyle: "italic" }}>ไม่มีรายละเอียดงบประมาณเพิ่มเติม</div>
              )}
            </div>
          </section>
        )}

        {/* 6. Price Comparison Summary */}
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 8 }}>เปรียบเทียบราคา / Price Comparison</div>
          {memo.priceComparisons && memo.priceComparisons.some(r => r.offeredPrice > 0) ? (() => {
            const rows = memo.priceComparisons!;
            const rowTotals = rows.map(r => ({ row: r, totals: computePriceRowTotals(r) }));
            const selectedEntry = rowTotals.find(rt => rt.row.id === memo.selectedVendorId) ?? rowTotals[0];
            const validNetPrices = rowTotals.filter(rt => rt.row.offeredPrice > 0).map(rt => rt.totals.netPrice);
            const lowest = validNetPrices.length > 0 ? Math.min(...validNetPrices) : 0;
            const selectedNet = selectedEntry?.totals.netPrice ?? 0;
            const diff = selectedNet - lowest;
            const isLowest = diff <= 0;
            const selectedVat = Boolean(selectedEntry?.row.vatEnabled);
            const selectedVatAmount = selectedEntry?.totals.vatAmount ?? 0;
            return (
              <div style={{ display: "grid", gap: 10 }}>
                {/* Per-vendor breakdown */}
                <div style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden", background: "var(--surface)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="em-table" style={{ fontSize: 12, tableLayout: "fixed", width: "100%", minWidth: 340 }}>
                      <colgroup>
                        <col />
                        <col style={{ width: 78 }} />
                        <col style={{ width: 70 }} />
                        <col style={{ width: 92 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ padding: "8px 12px" }}>ผู้ให้บริการ</th>
                          <th style={{ padding: "8px 8px", textAlign: "right" }}>ราคา</th>
                          <th style={{ padding: "8px 6px", textAlign: "center" }}>VAT</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>สุทธิ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowTotals.filter(rt => rt.row.offeredPrice > 0).map(({ row, totals }) => {
                          const isSelected = row.id === selectedEntry?.row.id;
                          const isRowLowest = totals.netPrice === lowest;
                          return (
                            <tr key={row.id} style={{ background: isSelected ? "var(--primary-soft)" : undefined }}>
                              <td style={{ padding: "8px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.vendorName}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  {isSelected && <IconCheck size={11} style={{ color: "var(--primary)" }} />}
                                  <span style={{ fontWeight: isSelected ? 600 : 500 }}>{row.vendorName?.trim() || "—"}</span>
                                </span>
                              </td>
                              <td style={{ padding: "8px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
                                ฿{totals.basePrice.toLocaleString()}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                {row.vatEnabled ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#7C5E0F", background: "var(--gold-soft)", padding: "1px 6px", borderRadius: 999, letterSpacing: "0.02em", border: "1px solid rgba(201,168,76,0.40)" }}>
                                    +7%
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--muted-2, #94a3b8)" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: isRowLowest ? "var(--emerald)" : "var(--ink)" }}>
                                ฿{totals.netPrice.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Decision summary */}
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--muted)" }}>Selected vendor</span>
                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {selectedEntry?.row.vendorName?.trim() || "—"} · <span className="em-amt">฿{selectedNet.toLocaleString()}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--muted)" }}>Lowest offer</span>
                    <span className="em-amt" style={{ fontWeight: 600, color: "var(--emerald)" }}>฿{lowest.toLocaleString()}</span>
                  </div>
                  {selectedVat && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--muted)" }}>VAT 7% (ผู้เลือก)</span>
                      <span className="em-amt" style={{ fontWeight: 600, color: "#7C5E0F" }}>+฿{selectedVatAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
                    <span style={{ color: "var(--muted)" }}>Difference</span>
                    <span className="em-amt" style={{ fontWeight: 700, color: isLowest ? "var(--emerald)" : "var(--amber)" }}>
                      {isLowest ? "เลือกราคาต่ำสุด" : `+฿${diff.toLocaleString()}`}
                    </span>
                  </div>
                  {memo.selectedVendorReason && (
                    <div style={{ marginTop: 2, padding: "8px 10px", borderRadius: 8, background: "var(--amber-soft)", color: "#7C5E0F", fontSize: 12, lineHeight: 1.55 }}>
                      <strong>เหตุผลเลือก vendor: </strong>{memo.selectedVendorReason}
                    </div>
                  )}
                  {memo.priceAdjustmentReason && (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "var(--gold-soft)", color: "#5C4708", fontSize: 12, lineHeight: 1.55, border: "1px solid rgba(201,168,76,0.30)" }}>
                      <strong style={{ color: "#7C5E0F" }}>เหตุผลปรับราคา: </strong>{memo.priceAdjustmentReason}
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px dashed var(--line-2)", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
              ไม่มีข้อมูลเปรียบเทียบราคา
            </div>
          )}
        </section>

        {/* 7. Conditional fields (Book1 flags) */}
        {(memo.followsProductionPlan || memo.isDeadStockOrSlowMovement || memo.isPriceAdjustment || memo.notifyMD ||
          (memo.departmentMonthlyOverBudgetTotal !== undefined && memo.departmentMonthlyOverBudgetTotal > 0)) && (
          <section>
            <div className="em-eyebrow" style={{ marginBottom: 8 }}>เงื่อนไขเพิ่มเติม / Conditional Flags (Book1)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {memo.followsProductionPlan && (
                <span className="em-tier gm">ซื้อตามแผนการผลิต</span>
              )}
              {memo.isDeadStockOrSlowMovement && (
                <span className="em-tier" style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "rgba(180,83,9,0.30)" }}>Dead stock / Slow movement</span>
              )}
              {memo.isPriceAdjustment && (
                <span className="em-tier" style={{ background: "var(--gold-soft)", color: "#7C5E0F", borderColor: "rgba(201,168,76,0.40)" }}>Supplier ปรับราคา</span>
              )}
              {memo.notifyMD && (
                <span className="em-tier md" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconBell size={10} /> แจ้ง MD เพื่อทราบ
                </span>
              )}
              {memo.departmentMonthlyOverBudgetTotal !== undefined && memo.departmentMonthlyOverBudgetTotal > 0 && (
                <span className="em-tier" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
                  Over-budget สะสม ฿{memo.departmentMonthlyOverBudgetTotal.toLocaleString()}
                </span>
              )}
            </div>
          </section>
        )}

        {/* 8. Read / Review recipients */}
        {memo.readRecipients && memo.readRecipients.length > 0 && !(memo.readActions && memo.readActions.length > 0) && (
          <section>
            <div className="em-eyebrow" style={{ marginBottom: 8 }}>ผู้รับทราบ / Read recipients</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {memo.readRecipients.map((r) => (
                <span key={r} className="em-dept" style={{ fontSize: 11.5 }}>{r}</span>
              ))}
            </div>
          </section>
        )}

        {memo.attachments && memo.attachments.length > 0 && (
          <section>
            <div className="em-eyebrow" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Attachments</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-soft)", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {memo.attachments.length} file{memo.attachments.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", gap: 6 }}>
              {memo.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={`/api/attachments/${encodeURIComponent(memo.id)}/${encodeURIComponent(attachment.storedName)}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`เปิดไฟล์ / Open ${attachment.originalName}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--primary)", textDecoration: "none" }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, textDecoration: "underline" }}>{attachment.originalName}</span>
                  <span style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0 }}>
                    {formatAttachmentSize(attachment.size)} · {attachment.uploadedAt}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        <hr className="em-divider" />

        {/* 10. Approval Route / Workflow */}
        <section>
          <div className="em-eyebrow" style={{ marginBottom: 8 }}>เส้นทางอนุมัติ / Approval Route</div>
          <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12, display: "grid", gap: 4 }}>
            <div><strong style={{ color: "var(--ink)" }}>Route:</strong> {routeSummary(memo)}</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              Mode: {memo.routeMode ?? "—"} · State: {memo.workflowState ?? (memo.status === "approved" ? "Approved" : memo.status === "rejected" ? "Rejected" : "Issued")}
            </div>
            {memo.routeMode === "exception" && memo.routeOverrideReason && (
              <div style={{ color: "var(--amber)", fontWeight: 600, marginTop: 2 }}>
                Exception: {memo.routeOverrideReason}
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
            {memo.readActions && memo.readActions.length > 0 && memo.readActions.map(ra => {
              const isRead = ra.status === "read";
              const isSkipped = ra.status === "skipped";
              const canMarkRead = canMarkReadRecipient(currentUser, ra.recipient);
              return (
                <div
                  key={`ra-${ra.recipient}`}
                  className={`em-flow-step${isRead ? " done" : ""}`}
                  style={isSkipped ? { opacity: 0.6 } : undefined}
                >
                  <div className="em-flow-dot">
                    {isRead ? <IconCheck size={14} /> : isSkipped ? <IconX size={12} /> : <IconBell size={12} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="em-flow-title">
                      {isRead ? (
                        <span>รับทราบแล้ว (Prototype){" "}
                          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11 }}>· {ra.actedAt}</span>
                        </span>
                      ) : isSkipped ? (
                        <span>ข้าม{" "}
                          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11 }}>· {ra.skipReason}</span>
                        </span>
                      ) : (
                        <span>รับทราบ{" "}
                          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11 }}>· {ra.recipient}</span>
                        </span>
                      )}
                    </div>
                    <div className="em-flow-meta">
                      {isRead || isSkipped ? ra.recipient : "รอรับทราบ"}
                    </div>
                    {ra.status === "pending" && memo.status === "pending" && (
                      <button
                        type="button"
                        className="em-btn sm"
                        style={{ marginTop: 6, fontSize: 11.5 }}
                        disabled={!canMarkRead}
                        title={canMarkRead ? "Mark read" : "ไม่มีสิทธิ์รับทราบแทนผู้รับรายนี้"}
                        onClick={() => onMarkRead(memo.id, ra.recipient)}
                      >
                        {canMarkRead ? "รับทราบ (Prototype)" : "รับทราบ (ไม่มีสิทธิ์)"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {(memo.selectedRoute ?? [memo.currentStep]).map((step, i, arr) => {
              const currentIdx = arr.indexOf(memo.currentStep);
              const isApproved = memo.status === "approved";
              // Guard: if currentStep is absent from the route (state drift or a
              // seed memo whose selectedRoute is inconsistent), treat the first
              // step as current instead of silently marking every step "pending".
              const effectiveIdx = currentIdx !== -1 ? currentIdx : 0;
              const isDone = isApproved || i < effectiveIdx;
              const isCurrent = !isApproved && i === effectiveIdx;
              const isMdStep = step === "Managing Director";
              return (
                <div
                  key={step}
                  className={`em-flow-step${isDone ? " done" : isCurrent ? " current" : ""}${isMdStep && isCurrent ? " md" : ""}`}
                >
                  <div className="em-flow-dot">
                    {isDone ? <IconCheck size={14} /> : isMdStep && isCurrent ? <IconCrown size={14} /> : i + 2 + readStepOffset}
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
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
            <span>Created · {createdAt}</span>
            <span>Updated · {memo.updatedAt}</span>
          </div>
        </section>

        {/* Revision history — shown only when at least one resubmit has occurred */}
        {memo.revisions && memo.revisions.length > 0 && (
          <section>
            <div className="em-eyebrow" style={{ marginBottom: 8 }}>Revision History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {memo.revisions.map((rev) => (
                <div key={rev.revisionNo} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: rev.returnReason || rev.rejectReason || rev.revisionNote ? 6 : 0 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
                      Rev.{rev.revisionNo}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>→</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
                      Rev.{rev.revisionNo + 1}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: rev.source === "return" ? "var(--amber)" : "var(--rose)", marginLeft: 2 }}>
                      {rev.source === "return" ? "ส่งกลับ" : "ปฏิเสธ (อนุญาตแก้ไข)"}
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{rev.submittedAt}</span>
                  </div>
                  {rev.returnReason && (
                    <div style={{ fontSize: 11.5, color: "var(--amber)", marginTop: 2 }}>เหตุผล: {rev.returnReason}</div>
                  )}
                  {rev.rejectReason && (
                    <div style={{ fontSize: 11.5, color: "var(--rose)", marginTop: 2 }}>ปฏิเสธ: {rev.rejectReason}</div>
                  )}
                  {rev.revisionNote && (
                    <div style={{ fontSize: 11.5, color: "#047857", marginTop: 2 }}>หมายเหตุ: {rev.revisionNote}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Audit Log — append-only DB events from workflow_step_actions.
            Distinct from the Approval Route section above, which shows current workflow state.
            Collapsed by default; fetches lazily on first expand. */}
        <AuditLogSection memoId={memo.id} refreshKey={auditRefreshKey} />
      </div>

      <DrawerFooter
        memo={memo}
        currentUser={currentUser}
        onAction={onAction}
        onReject={onReject}
        onReturn={onReturn}
        onResubmit={onResubmit}
        onSkipAllReads={onSkipAllReads}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function BudgetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
