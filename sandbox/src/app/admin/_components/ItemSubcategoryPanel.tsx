"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { approvalLabels, type ApprovalCategory } from "@/lib/approval";
import type { ItemSubcategory } from "@/lib/item-subcategories";
import { IconCheck, IconPen, IconRefresh, IconTag, IconX } from "@/components/icons";

type AdminItemSubcategory = ItemSubcategory & {
  sourceReference?: string;
};

type Draft = {
  categoryKey: ApprovalCategory;
  labelTh: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  categoryKey: "general-purchase",
  labelTh: "",
  sortOrder: 10,
  isActive: true,
});

const fieldStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
};

export function ItemSubcategoryPanel() {
  const [items, setItems] = useState<AdminItemSubcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const raf = requestAnimationFrame(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
    });
    fetch("/api/admin/item-subcategories", { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { items: AdminItemSubcategory[] }) => setItems(data.items))
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("โหลดหมวดรายการย่อยไม่สำเร็จ ตรวจสอบ DB migration หรือสิทธิ์ admin");
        setItems([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); cancelAnimationFrame(raf); };
  }, [refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<ApprovalCategory, AdminItemSubcategory[]>();
    for (const category of Object.keys(approvalLabels) as ApprovalCategory[]) {
      map.set(category, []);
    }
    for (const item of items) {
      const rows = map.get(item.categoryKey) ?? [];
      rows.push(item);
      map.set(item.categoryKey, rows);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => a.sortOrder - b.sortOrder || a.labelTh.localeCompare(b.labelTh, "th"));
    }
    return map;
  }, [items]);

  async function createItem() {
    if (!newDraft.labelTh.trim()) {
      setError("กรุณาระบุชื่อหมวดรายการย่อย");
      return;
    }
    const response = await fetch("/api/admin/item-subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDraft),
    });
    if (!response.ok) {
      setError("เพิ่มหมวดรายการย่อยไม่สำเร็จ");
      return;
    }
    setNewDraft(emptyDraft());
    setRefreshKey(n => n + 1);
  }

  async function saveEdit(id: number) {
    if (!editDraft?.labelTh.trim()) {
      setError("กรุณาระบุชื่อหมวดรายการย่อย");
      return;
    }
    const response = await fetch(`/api/admin/item-subcategories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDraft),
    });
    if (!response.ok) {
      setError("บันทึกหมวดรายการย่อยไม่สำเร็จ");
      return;
    }
    setEditingId(null);
    setEditDraft(null);
    setRefreshKey(n => n + 1);
  }

  async function toggleActive(item: AdminItemSubcategory) {
    const response = await fetch(`/api/admin/item-subcategories/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    if (!response.ok) {
      setError("อัปเดตสถานะไม่สำเร็จ");
      return;
    }
    setRefreshKey(n => n + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>หมวดรายการย่อย / Item Subcategories</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            ใช้เป็นตัวเลือกเสริมหลังเลือกหมวดหลักเท่านั้น ไม่เปลี่ยน approval rule
          </div>
        </div>
        <button className="em-btn" onClick={() => setRefreshKey(n => n + 1)} disabled={loading}>
          <IconRefresh size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="em-card" style={{ padding: 12, color: "#B91C1C", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
          {error}
        </div>
      )}

      <div className="em-card" style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 0.8fr) minmax(220px, 1.4fr) 90px 100px auto", gap: 10, alignItems: "end" }}>
          <Field label="หมวดหลัก">
            <CategorySelect value={newDraft.categoryKey} onChange={(categoryKey) => setNewDraft(d => ({ ...d, categoryKey }))} />
          </Field>
          <Field label="หมวดรายการย่อย">
            <input style={{ ...fieldStyle, width: "100%" }} value={newDraft.labelTh} onChange={e => setNewDraft(d => ({ ...d, labelTh: e.target.value }))} placeholder="เช่น รถยนต์" />
          </Field>
          <Field label="ลำดับ">
            <input style={{ ...fieldStyle, width: "100%" }} type="number" value={newDraft.sortOrder} onChange={e => setNewDraft(d => ({ ...d, sortOrder: Number(e.target.value) }))} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--muted)", paddingBottom: 9 }}>
            <input type="checkbox" checked={newDraft.isActive} onChange={e => setNewDraft(d => ({ ...d, isActive: e.target.checked }))} />
            Active
          </label>
          <button className="em-btn primary" onClick={createItem}><IconTag size={14} /> Add</button>
        </div>
      </div>

      {[...grouped.entries()].map(([category, rows]) => (
        <div key={category} className="em-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{approvalLabels[category]}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{rows.filter(r => r.isActive).length} active / {rows.length} total</div>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>ยังไม่มีรายการย่อย</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {rows.map(item => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border)", opacity: item.isActive ? 1 : 0.58 }}>
                      {editingId === item.id && editDraft ? (
                        <td colSpan={5} style={{ padding: 12 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 0.8fr) minmax(220px, 1.4fr) 90px 100px auto", gap: 10, alignItems: "end" }}>
                            <CategorySelect value={editDraft.categoryKey} onChange={(categoryKey) => setEditDraft(d => d ? ({ ...d, categoryKey }) : d)} />
                            <input style={{ ...fieldStyle, width: "100%" }} value={editDraft.labelTh} onChange={e => setEditDraft(d => d ? ({ ...d, labelTh: e.target.value }) : d)} />
                            <input style={{ ...fieldStyle, width: "100%" }} type="number" value={editDraft.sortOrder} onChange={e => setEditDraft(d => d ? ({ ...d, sortOrder: Number(e.target.value) }) : d)} />
                            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                              <input type="checkbox" checked={editDraft.isActive} onChange={e => setEditDraft(d => d ? ({ ...d, isActive: e.target.checked }) : d)} />
                              Active
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="em-btn primary" onClick={() => saveEdit(item.id)}><IconCheck size={13} /> Save</button>
                              <button className="em-btn" onClick={() => { setEditingId(null); setEditDraft(null); }}><IconX size={13} /> Cancel</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: "10px 14px", width: 72, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>#{item.sortOrder}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 650 }}>{item.labelTh}</td>
                          <td style={{ padding: "10px 14px", color: "var(--muted)", fontSize: 12 }}>{item.sourceReference ?? "Admin"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <button className="em-btn" style={{ fontSize: 12, color: item.isActive ? "#B45309" : "#047857" }} onClick={() => toggleActive(item)}>
                              {item.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <button className="em-btn" style={{ fontSize: 12 }} onClick={() => {
                              setEditingId(item.id);
                              setEditDraft({ categoryKey: item.categoryKey, labelTh: item.labelTh, sortOrder: item.sortOrder, isActive: item.isActive });
                            }}>
                              <IconPen size={12} /> Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function CategorySelect({ value, onChange }: { value: ApprovalCategory; onChange: (value: ApprovalCategory) => void }) {
  return (
    <select style={{ ...fieldStyle, width: "100%" }} value={value} onChange={e => onChange(e.target.value as ApprovalCategory)}>
      {(Object.keys(approvalLabels) as ApprovalCategory[]).map(category => (
        <option key={category} value={category}>{approvalLabels[category]}</option>
      ))}
    </select>
  );
}
