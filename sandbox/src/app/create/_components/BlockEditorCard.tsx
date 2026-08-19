"use client";

import type { ReactNode } from "react";
import type { UseBodyBlocksResult } from "../_hooks/useBodyBlocks";
import { ParagraphBlock } from "./blocks/ParagraphBlock";
import { TableBlock } from "./blocks/TableBlock";
import { KeyValueBlock } from "./blocks/KeyValueBlock";

const BLOCK_TITLE = {
  paragraph: "ย่อหน้า",
  table: "ตาราง",
  keyValue: "หัวข้อ–ค่า",
  system: "บล็อกระบบ",
} as const;

type Props = {
  body: UseBodyBlocksResult;
  /** การ์ดเดิมทั้งใบ ส่งเข้ามาเพื่อให้กฎของ V2 §2 ติดมาครบ ไม่สร้าง UI ใหม่ */
  systemSlots: { priceComparison: ReactNode; requestItems: ReactNode };
};

export function BlockEditorCard({ body, systemSlots }: Props) {
  const { blocks, addBlock, updateBlock, removeBlockById, moveBlockBy, isSystemBlockUsed } = body;

  return (
    <section className="em-card em-block-editor">
      <h3 className="em-card-title">เนื้อหาเมโม</h3>

      {blocks.length === 0 ? (
        <p className="em-hint">ยังไม่มีเนื้อหา — กด &quot;เพิ่มบล็อก&quot; ด้านล่างเพื่อเริ่ม</p>
      ) : null}

      {blocks.map((block, index) => (
        <div key={block.id} className="em-block">
          <header className="em-block-head">
            <span className="em-block-kind">{BLOCK_TITLE[block.type]}</span>
            <span className="em-block-tools">
              <button
                type="button"
                className="em-btn sm icon-only ghost"
                aria-label="เลื่อนขึ้น"
                disabled={index === 0}
                onClick={() => moveBlockBy(block.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="em-btn sm icon-only ghost"
                aria-label="เลื่อนลง"
                disabled={index === blocks.length - 1}
                onClick={() => moveBlockBy(block.id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="em-btn sm icon-only danger"
                aria-label="ลบบล็อกนี้"
                onClick={() => removeBlockById(block.id)}
              >
                🗑
              </button>
            </span>
          </header>

          {block.type === "paragraph" ? (
            <ParagraphBlock text={block.text} onChange={(text) => updateBlock(block.id, { text } as never)} />
          ) : null}

          {block.type === "table" ? (
            <TableBlock
              headers={block.headers}
              rows={block.rows}
              onChange={(next) => updateBlock(block.id, next as never)}
            />
          ) : null}

          {block.type === "keyValue" ? (
            <KeyValueBlock
              pairs={block.pairs}
              onChange={(pairs) => updateBlock(block.id, { pairs } as never)}
            />
          ) : null}

          {block.type === "system" ? systemSlots[block.ref] : null}
        </div>
      ))}

      <div className="em-block-add">
        <button type="button" className="em-btn sm ghost" onClick={() => addBlock("paragraph")}>
          + ย่อหน้า
        </button>
        <button type="button" className="em-btn sm ghost" onClick={() => addBlock("table")}>
          + ตาราง
        </button>
        <button type="button" className="em-btn sm ghost" onClick={() => addBlock("keyValue")}>
          + หัวข้อ–ค่า
        </button>
        <button
          type="button"
          className="em-btn sm ghost"
          disabled={isSystemBlockUsed("priceComparison")}
          onClick={() => addBlock("system", "priceComparison")}
        >
          + ตารางเปรียบเทียบราคา
        </button>
        <button
          type="button"
          className="em-btn sm ghost"
          disabled={isSystemBlockUsed("requestItems")}
          onClick={() => addBlock("system", "requestItems")}
        >
          + รายการที่ขอ
        </button>
      </div>
    </section>
  );
}
