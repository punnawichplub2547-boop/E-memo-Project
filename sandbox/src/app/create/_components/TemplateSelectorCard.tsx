import React from "react";
import { IconX } from "@/components/icons";

interface MemoTemplate {
  id: number;
  userId: number;
  name: string;
  templateJson: string;
  createdAt: string;
  updatedAt: string;
}

interface TemplateSelectorCardProps {
  templates: MemoTemplate[];
  onSelectTemplate: (id: number, name: string, template: Record<string, unknown>) => void;
  onDeleteTemplate: (id: number) => void;
  isLoading: boolean;
}

export function TemplateSelectorCard({
  templates,
  onSelectTemplate,
  onDeleteTemplate,
  isLoading,
}: TemplateSelectorCardProps) {
  if (isLoading) {
    return (
      <div className="em-card" style={{ padding: "16px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
          ⚡ โหลดจากแม่แบบคำขออนุมัติ (Load Template)
        </h3>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>กำลังโหลดรายการแม่แบบ...</div>
      </div>
    );
  }

  return (
    <div className="em-card" style={{ padding: "16px", marginBottom: "16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
        ⚡ โหลดจากแม่แบบคำขออนุมัติ (Load Template)
      </h3>
      {templates.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
          คุณยังไม่มีแม่แบบเก็บไว้ สามารถบันทึกฟอร์มปัจจุบันเป็นแม่แบบส่วนตัวได้โดยคลิกปุ่ม &quot;Save Template&quot; ที่แถบเครื่องมือด้านบน
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {templates.map((tpl) => {
            let data: Record<string, unknown> = {};
            try {
              data = JSON.parse(tpl.templateJson) as Record<string, unknown>;
            } catch (e) {
              console.error("Failed to parse template json", e);
            }
            return (
              <div
                key={tpl.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                  padding: "6px 12px",
                  fontSize: 13,
                  gap: 10,
                  transition: "all 0.15s ease",
                }}
                className="em-template-chip"
              >
                <button
                  type="button"
                  onClick={() => onSelectTemplate(tpl.id, tpl.name, data)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontWeight: 500,
                    color: "var(--ink-2)",
                    textAlign: "left",
                    outline: "none",
                  }}
                  title={`หมวดหมู่: ${data.category || ""}`}
                >
                  {tpl.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`คุณต้องการลบแม่แบบ "${tpl.name}" ใช่หรือไม่?`)) {
                      onDeleteTemplate(tpl.id);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 2,
                    cursor: "pointer",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    outline: "none",
                  }}
                  className="em-template-delete"
                  title="ลบแม่แบบ"
                >
                  <IconX size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
