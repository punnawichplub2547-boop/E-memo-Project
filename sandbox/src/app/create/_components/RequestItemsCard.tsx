import { type RequestItem } from "@/lib/approval";
import { IconFileText, IconX } from "@/components/icons";

const effectiveQty = (qty: number) => (qty > 0 ? qty : 1);

interface RequestItemsCardProps {
  requestItems: RequestItem[];
  amount: number;
  requestItemsGrandTotal: number;
  addRequestItem: () => void;
  removeRequestItem: (id: string) => void;
  updateRequestItem: (id: string, updates: Partial<Omit<RequestItem, "id">>) => void;
}

export function RequestItemsCard({
  requestItems,
  amount,
  requestItemsGrandTotal,
  addRequestItem,
  removeRequestItem,
  updateRequestItem,
}: RequestItemsCardProps) {
  return (
    <div className="em-card">
      <div className="em-card-head" style={{ padding: "14px 18px" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <IconFileText size={14} />
            </span>
            รายการที่ขออนุมัติ / Request Items
          </h3>
          <div className="em-sub" style={{ marginTop: 2 }}>รายละเอียดสินค้า / บริการที่ต้องการ</div>
        </div>
        <button type="button" className="em-btn sm ghost" onClick={addRequestItem} style={{ whiteSpace: "nowrap" }}>
          + เพิ่มรายการ
        </button>
      </div>
      <div className="em-card-body" style={{ padding: "10px 18px 18px" }}>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)" }}>
          <table className="em-table" style={{ minWidth: 560, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 14px", minWidth: 180 }}>รายการ / Item</th>
                <th style={{ padding: "10px 12px", width: 84 }}>หน่วย</th>
                <th style={{ padding: "10px 12px", width: 90, textAlign: "right" }}>จำนวน</th>
                <th style={{ padding: "10px 12px", width: 130, textAlign: "right" }}>ราคา/หน่วย (฿)</th>
                <th style={{ padding: "10px 14px", width: 130, textAlign: "right" }}>รวม (฿)</th>
                <th style={{ padding: "10px 8px", width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {requestItems.map((row) => {
                const lineTotal = Math.round(effectiveQty(row.qty) * row.unitPrice);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: "10px 14px" }}>
                      <input className="em-table-input" value={row.name}
                        placeholder="ชื่อรายการ / บริการ"
                        onChange={e => updateRequestItem(row.id, { name: e.target.value })} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input className="em-table-input" value={row.unit}
                        placeholder="ชิ้น"
                        onChange={e => updateRequestItem(row.id, { unit: e.target.value })} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input className="em-table-input num" type="number" min={1}
                        value={effectiveQty(row.qty)} placeholder="1"
                        onChange={e => updateRequestItem(row.id, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <input className="em-table-input num" type="number" min={0}
                        value={row.unitPrice || ""} placeholder="0"
                        onChange={e => updateRequestItem(row.id, { unitPrice: Number(e.target.value) || 0 })} />
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      ฿{lineTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <button type="button" onClick={() => removeRequestItem(row.id)}
                        disabled={requestItems.length === 1}
                        style={{ background: "none", border: "none", cursor: requestItems.length === 1 ? "default" : "pointer", color: "var(--rose)", opacity: requestItems.length === 1 ? 0.25 : 1, display: "grid", placeItems: "center", padding: 4 }}>
                        <IconX size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--line)" }}>
                <td colSpan={4} style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>ยอดรวมทั้งสิ้น</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 14, fontWeight: 700, color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
                  ฿{requestItemsGrandTotal.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {requestItemsGrandTotal > 0 && requestItemsGrandTotal !== amount && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--amber)", fontWeight: 500 }}>
            ยอดรายการ ฿{requestItemsGrandTotal.toLocaleString()} ≠ จำนวนเงิน ฿{amount.toLocaleString()} — กรุณาตรวจสอบให้ตรงกัน
          </div>
        )}
      </div>
    </div>
  );
}
