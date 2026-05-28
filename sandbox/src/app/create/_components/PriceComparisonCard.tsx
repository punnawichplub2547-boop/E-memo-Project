import { type PriceComparison, computePriceRowTotals } from "@/lib/approval";
import { IconWallet, IconUpload, IconX } from "@/components/icons";
import { VatPill } from "./VatPill";
import { DecisionCell } from "./DecisionCell";

interface PriceComparisonCardProps {
  priceComparisons: PriceComparison[];
  isPdfLoading: boolean;
  pdfError: string | null;
  selectedVendor: PriceComparison | undefined;
  selectedVendorReason: string;
  lowestNetPrice: number;
  hasPricedVendor: boolean;
  selectedNotLowest: boolean;
  selectedVendorVat: boolean;
  selectedVendorVatAmount: number;
  lowestOfferSummary: string;
  selectedVendorSummary: string;
  addVendorRow: () => void;
  removeVendorRow: (id: string) => void;
  updateVendorRow: (id: string, updates: Partial<PriceComparison>) => void;
  onSelectVendor: (id: string) => void;
  onPdfButtonClick: () => void;
  onClearPdfError: () => void;
  onSelectedVendorReasonChange: (v: string) => void;
}

export function PriceComparisonCard({
  priceComparisons,
  isPdfLoading,
  pdfError,
  selectedVendor,
  selectedVendorReason,
  lowestNetPrice,
  hasPricedVendor,
  selectedNotLowest,
  selectedVendorVat,
  selectedVendorVatAmount,
  lowestOfferSummary,
  selectedVendorSummary,
  addVendorRow,
  removeVendorRow,
  updateVendorRow,
  onSelectVendor,
  onPdfButtonClick,
  onClearPdfError,
  onSelectedVendorReasonChange,
}: PriceComparisonCardProps) {
  return (
    <div className="em-card em-price-card" style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(60% 70% at 100% 0%, rgba(201,168,76,0.05), transparent 60%)" }} />
      <div className="em-card-head" style={{ padding: "14px 18px" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--primary-soft) 0%, var(--surface-soft) 100%)", color: "var(--primary)", display: "grid", placeItems: "center", border: "1px solid var(--primary-soft)" }}>
              <IconWallet size={14} />
            </span>
            เปรียบเทียบราคา / Price Comparison
          </h3>
          <div className="em-sub" style={{ marginTop: 3 }}>เปรียบเทียบผู้เสนอราคา · เลือกผู้ขายอ้างอิงข้อมูลและงบประมาณ</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="em-btn sm ghost"
            onClick={onPdfButtonClick}
            disabled={isPdfLoading}
            title="อัปโหลดใบเสนอราคา PDF เพื่อดึงข้อมูลอัตโนมัติ"
            style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}
          >
            <IconUpload size={12} />
            {isPdfLoading ? "กำลังอ่าน..." : "อ่าน PDF"}
          </button>
          <button type="button" className="em-btn sm ghost" onClick={addVendorRow} style={{ whiteSpace: "nowrap" }}>
            + เพิ่มผู้ให้บริการ
          </button>
        </div>
      </div>
      {pdfError && (
        <div style={{ margin: "0 20px 12px", padding: "10px 14px", borderRadius: 8, background: "var(--amber-soft)", border: "1px solid rgba(180,83,9,0.22)", fontSize: 12, color: "var(--amber)", display: "flex", alignItems: "center", gap: 8 }}>
          <IconX size={12} />
          <span style={{ flex: 1 }}>{pdfError}</span>
          <button type="button" onClick={onClearPdfError} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--amber)", padding: 0, display: "grid", placeItems: "center" }}>
            <IconX size={11} />
          </button>
        </div>
      )}
      <div className="em-card-body" style={{ padding: "6px 18px 18px" }}>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)" }}>
          <table className="em-table" style={{ minWidth: 780, width: "100%" }}>
            <colgroup>
              <col style={{ width: 48 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 168 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 44 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: "10px 8px", textAlign: "center" }}></th>
                <th style={{ padding: "10px 14px" }}>ผู้ให้บริการ</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>ราคาเสนอ (฿)</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>ส่วนลด (฿)</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>VAT 7%</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>ราคาสุทธิ</th>
                <th style={{ padding: "10px 12px" }}>หมายเหตุ</th>
                <th style={{ padding: "10px 6px" }}></th>
              </tr>
            </thead>
            <tbody>
              {priceComparisons.map((row) => {
                const { basePrice, vatAmount, netPrice } = computePriceRowTotals(row);
                const isLowest = lowestNetPrice > 0 && row.offeredPrice > 0 && netPrice === lowestNetPrice && priceComparisons.length > 1;
                return (
                  <tr key={row.id} style={{ background: row.isSelected ? "var(--surface-soft)" : undefined }}>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <input
                        type="radio"
                        name="vendor-select"
                        checked={row.isSelected}
                        onChange={() => onSelectVendor(row.id)}
                        style={{ accentColor: "var(--primary)", width: 15, height: 15, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <input
                        className="em-table-input"
                        value={row.vendorName}
                        placeholder="ชื่อบริษัท / ผู้ให้บริการ"
                        onChange={e => updateVendorRow(row.id, { vendorName: e.target.value })}
                      />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        className="em-table-input num"
                        type="number"
                        min={0}
                        value={row.offeredPrice || ""}
                        placeholder="0"
                        onChange={e => updateVendorRow(row.id, { offeredPrice: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        className="em-table-input num"
                        type="number"
                        min={0}
                        value={row.discount || ""}
                        placeholder="0"
                        onChange={e => updateVendorRow(row.id, { discount: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <VatPill
                        enabled={row.vatEnabled ?? false}
                        vatAmount={vatAmount}
                        onChange={(v) => updateVendorRow(row.id, { vatEnabled: v })}
                      />
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: isLowest ? "var(--emerald)" : "var(--ink)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                          ฿{netPrice.toLocaleString()}
                        </span>
                        {(row.vatEnabled || isLowest) && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                            {row.vatEnabled && basePrice > 0 && (
                              <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>incl. VAT ฿{vatAmount.toLocaleString()}</span>
                            )}
                            {isLowest && (
                              <span style={{ fontWeight: 700, color: "var(--emerald)", background: "var(--emerald-soft)", padding: "1px 6px", borderRadius: 999, letterSpacing: "0.02em" }}>
                                ต่ำสุด
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        className="em-table-input"
                        value={row.remark ?? ""}
                        placeholder="—"
                        onChange={e => updateVendorRow(row.id, { remark: e.target.value })}
                      />
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => removeVendorRow(row.id)}
                        disabled={priceComparisons.length === 1}
                        style={{
                          background: "none", border: "none",
                          cursor: priceComparisons.length === 1 ? "default" : "pointer",
                          color: "var(--rose)",
                          opacity: priceComparisons.length === 1 ? 0.25 : 1,
                          display: "grid", placeItems: "center", padding: 4,
                        }}
                      >
                        <IconX size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: 12,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(37,99,235,0.16)",
          background: "linear-gradient(180deg, #FCFDFF 0%, #F6F9FF 100%)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.88) inset, 0 12px 28px -24px rgba(30,58,138,0.35)",
        }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "linear-gradient(90deg, rgba(37,99,235,0.05), rgba(201,168,76,0.06))" }}>
            <div>
              <div className="em-eyebrow" style={{ color: "var(--primary)", marginBottom: 3 }}>Decision panel</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>สรุปการตัดสินใจจากราคาสุทธิรวม VAT ต่อแถว</div>
            </div>
            {selectedVendorVat && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7C5E0F", background: "var(--gold-soft)", border: "1px solid rgba(201,168,76,0.42)", borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap" }}>
                VAT 7% +฿{selectedVendorVatAmount.toLocaleString()}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <DecisionCell
              label="Lowest net price"
              value={lowestNetPrice > 0 ? `฿${lowestNetPrice.toLocaleString()}` : "—"}
              sub={hasPricedVendor ? "ราคาสุทธิต่ำสุด" : "รอกรอกราคา"}
              tone={hasPricedVendor ? "emerald" : "neutral"}
            />
            <DecisionCell
              label="Selected vendor"
              value={selectedVendor?.vendorName?.trim() || "—"}
              sub={selectedVendor?.vendorName?.trim() ? "ผู้ขายที่เลือก" : "รอชื่อผู้ขาย"}
            />
            <DecisionCell
              label="Difference"
              value={hasPricedVendor ? (selectedNotLowest ? `+฿${((selectedVendor?.netPrice ?? 0) - lowestNetPrice).toLocaleString()}` : "฿0") : "—"}
              sub={hasPricedVendor ? (selectedNotLowest ? "สูงกว่าต่ำสุด" : "เลือกราคาต่ำสุด") : "รอเปรียบเทียบ"}
              tone={hasPricedVendor ? (selectedNotLowest ? "amber" : "emerald") : "neutral"}
            />
            <DecisionCell
              label="VAT impact"
              value={selectedVendorVat ? `+฿${selectedVendorVatAmount.toLocaleString()}` : "฿0"}
              sub={selectedVendorVat ? "VAT 7% ผู้ขายที่เลือก" : "ไม่คิด VAT แถวที่เลือก"}
              tone={selectedVendorVat ? "gold" : "neutral"}
            />
            <DecisionCell
              label="Final selected net"
              value={hasPricedVendor && selectedVendor && selectedVendor.netPrice > 0 ? `฿${selectedVendor.netPrice.toLocaleString()}` : "—"}
              sub={hasPricedVendor ? "ยอดสุดท้ายเพื่ออนุมัติ" : "รอกรอกราคา"}
              tone={hasPricedVendor ? "gold" : "neutral"}
              hideRightBorder
            />
          </div>
        </div>

        {hasPricedVendor && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--ink)" }}>Quick summary:</strong>{" "}
            Lowest offer {lowestOfferSummary} · Selected vendor {selectedVendorSummary}
            {selectedVendorVat && ` (รวม VAT 7% +฿${selectedVendorVatAmount.toLocaleString()})`}
            {" · "}Difference from lowest {selectedNotLowest ? `+฿${((selectedVendor?.netPrice ?? 0) - lowestNetPrice).toLocaleString()}` : "฿0"}
          </div>
        )}

        {selectedNotLowest && (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, background: "var(--amber-soft)", border: "1px solid rgba(180,83,9,0.22)" }}>
            <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 700, marginBottom: 6 }}>
              ราคาที่เลือกไม่ใช่ราคาต่ำสุด — กรุณาระบุเหตุผล
            </div>
            <div className="em-field" style={{ gap: 4 }}>
              <label className="em-label" style={{ fontSize: 11.5 }}>
                เหตุผลที่ไม่เลือกผู้เสนอราคาต่ำสุด <span className="req">*</span>
              </label>
              <textarea
                className="em-textarea"
                style={{ minHeight: 60 }}
                placeholder="เช่น คุณภาพสินค้า, ประสบการณ์ผู้ขาย, ระยะเวลาส่งมอบ, บริการหลังการขาย"
                value={selectedVendorReason}
                onChange={e => onSelectedVendorReasonChange(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
