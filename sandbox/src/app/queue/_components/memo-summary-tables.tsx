"use client";

import { MemoRecord, computePriceRowTotals } from "@/lib/approval";
import { IconCheck } from "@/components/icons";

/**
 * Request Items / Price Comparison, split out of drawer-panel.tsx (Task 13)
 * purely to keep that file under the project's 700-line guardrail while
 * still building each section's JSX exactly once. `DrawerPanel` renders
 * these directly in standard mode, and passes them (already-built React
 * elements) into `MemoBodyBlocksSection`'s `systemSlots` in free-form mode
 * — never a second copy of this markup or its VAT/discount math (V2 §2).
 */

export function RequestItemsSection({ memo }: { memo: MemoRecord }) {
  return (
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
  );
}

export function PriceComparisonSection({ memo }: { memo: MemoRecord }) {
  return (
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
  );
}
