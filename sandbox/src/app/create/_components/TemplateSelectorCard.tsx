import React, { useState } from "react";
import { IconX } from "@/components/icons";
import type { MemoTemplateSummary } from "@/lib/db-templates";
import {
  filterTemplates,
  countTemplatesByCategory,
  templateCategoryLabel,
  formatTemplateDate,
} from "@/lib/template-filters";

/** How many chips to show before the user asks for more. */
const VISIBLE_LIMIT = 12;

interface TemplateSelectorCardProps {
  templates: MemoTemplateSummary[];
  onSelectTemplate: (id: number, name: string) => void;
  onDeleteTemplate: (id: number) => void;
  isLoading: boolean;
  loadingTemplateId: number | null;
}

export function TemplateSelectorCard({
  templates,
  onSelectTemplate,
  onDeleteTemplate,
  isLoading,
  loadingTemplateId,
}: TemplateSelectorCardProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="em-card" style={{ padding: "16px", marginBottom: "16px" }}>
        <h3 className="em-template-title">⚡ โหลดจากแม่แบบคำขออนุมัติ (Load Template)</h3>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>กำลังโหลดรายการแม่แบบ...</div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="em-card" style={{ padding: "16px", marginBottom: "16px" }}>
        <h3 className="em-template-title">⚡ โหลดจากแม่แบบคำขออนุมัติ (Load Template)</h3>
        <div style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
          คุณยังไม่มีแม่แบบเก็บไว้ สามารถบันทึกฟอร์มปัจจุบันเป็นแม่แบบส่วนตัวได้โดยคลิกปุ่ม &quot;Save Template&quot; ที่แถบเครื่องมือด้านบน
        </div>
      </div>
    );
  }

  const categories = countTemplatesByCategory(templates);
  const filtered = filterTemplates(templates, { query, category: activeCategory });
  const isTruncated = !showAll && filtered.length > VISIBLE_LIMIT;
  const visible = isTruncated ? filtered.slice(0, VISIBLE_LIMIT) : filtered;

  const resetPaging = () => setShowAll(false);

  return (
    <div className="em-card" style={{ padding: "16px", marginBottom: "16px" }}>
      <h3 className="em-template-title">
        ⚡ โหลดจากแม่แบบคำขออนุมัติ (Load Template) <span className="em-template-count">{templates.length}</span>
      </h3>

      <div className="em-template-toolbar">
        <input
          type="search"
          className="em-input em-template-search"
          placeholder="ค้นหาแม่แบบจากชื่อหรือหมวดหมู่..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            resetPaging();
          }}
          aria-label="ค้นหาแม่แบบ"
        />
        <div className="em-template-cats">
          <button
            type="button"
            className={`em-template-cat${activeCategory === null ? " is-active" : ""}`}
            onClick={() => {
              setActiveCategory(null);
              resetPaging();
            }}
          >
            ทั้งหมด <span className="em-template-cat-n">{templates.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              className={`em-template-cat${activeCategory === cat.label ? " is-active" : ""}`}
              onClick={() => {
                setActiveCategory(activeCategory === cat.label ? null : cat.label);
                resetPaging();
              }}
            >
              {cat.label} <span className="em-template-cat-n">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="em-template-empty">
          <span>ไม่พบแม่แบบที่ตรงกับ &quot;{query}&quot;</span>
          <button
            type="button"
            className="em-template-clear"
            onClick={() => {
              setQuery("");
              setActiveCategory(null);
              resetPaging();
            }}
          >
            ล้างคำค้น
          </button>
        </div>
      ) : (
        <>
          <div className="em-template-grid">
            {visible.map((tpl) => {
              const dateLabel = formatTemplateDate(tpl.updatedAt);
              const isChipLoading = loadingTemplateId === tpl.id;
              return (
                <div key={tpl.id} className={`em-template-chip${isChipLoading ? " is-loading" : ""}`}>
                  <button
                    type="button"
                    className="em-template-pick"
                    onClick={() => onSelectTemplate(tpl.id, tpl.name)}
                    disabled={loadingTemplateId !== null}
                  >
                    <span className="em-template-name">{tpl.name}</span>
                    <span className="em-template-meta">
                      {templateCategoryLabel(tpl.category)}
                      {dateLabel ? ` · ${dateLabel}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="em-template-delete"
                    title="ลบแม่แบบ"
                    disabled={loadingTemplateId !== null}
                    onClick={() => {
                      // The date is part of the prompt because monthly templates
                      // differ only by a suffix and are easy to delete by mistake.
                      const label = dateLabel ? `"${tpl.name}" (${dateLabel})` : `"${tpl.name}"`;
                      if (confirm(`คุณต้องการลบแม่แบบ ${label} ใช่หรือไม่?`)) {
                        onDeleteTemplate(tpl.id);
                      }
                    }}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {isTruncated && (
            <button type="button" className="em-template-more" onClick={() => setShowAll(true)}>
              ⌄ แสดงเพิ่ม (อีก {filtered.length - VISIBLE_LIMIT})
            </button>
          )}
        </>
      )}
    </div>
  );
}
