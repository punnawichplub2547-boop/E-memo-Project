"use client";

import { useState, type ReactNode } from "react";
import type { UseBodyBlocksResult } from "../_hooks/useBodyBlocks";
import { blockHasContent } from "@/lib/memo-body-blocks";
import { IconArrowUp, IconArrowDown, IconTrash, IconCheck, IconX } from "@/components/icons";
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

  // C3 (UX review): deleting a block was instant and there is no undo anywhere
  // in the app, while switching form mode — which loses the same content but is
  // deliberate and cancellable — already asks first. Same two-step inline
  // pattern as FormModeToggle, and only for blocks that actually hold something
  // (blockHasContent); an empty block just added by mistake still goes in one click.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const requestRemove = (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (block && blockHasContent(block)) {
      setConfirmingId(id);
      return;
    }
    removeBlockById(id);
  };

  const confirmRemove = (id: string) => {
    setConfirmingId(null);
    removeBlockById(id);
  };

  return (
    <div className="em-card em-block-editor">
      <div className="em-card-head">
        <h3>เนื้อหาเมโม</h3>
      </div>
      <div className="em-card-body">
        {blocks.length === 0 ? (
          <p className="em-hint">ยังไม่มีเนื้อหา — กด &quot;เพิ่มบล็อก&quot; ด้านล่างเพื่อเริ่ม</p>
        ) : null}

        {blocks.map((block, index) => (
          <div key={block.id} className="em-block">
            <header className="em-block-head">
              <span className="em-block-kind">{BLOCK_TITLE[block.type]}</span>
              {confirmingId === block.id ? (
                <span className="em-block-confirm" role="alert">
                  <span className="em-block-confirm-text">
                    {block.type === "system"
                      ? "ลบบล็อกนี้จะล้างข้อมูลที่บล็อกชี้อยู่ออกจากเมโมด้วย ยืนยันหรือไม่?"
                      : "ลบบล็อกนี้พร้อมเนื้อหาข้างในทั้งหมด ยืนยันหรือไม่?"}
                  </span>
                  <button
                    type="button"
                    className="em-btn sm"
                    aria-label={`ยืนยันลบบล็อก${BLOCK_TITLE[block.type]}`}
                    onClick={() => confirmRemove(block.id)}
                  >
                    <IconCheck size={12} /> ยืนยัน
                  </button>
                  <button
                    type="button"
                    className="em-btn sm ghost"
                    aria-label="ยกเลิกการลบบล็อก"
                    onClick={() => setConfirmingId(null)}
                  >
                    <IconX size={12} /> ยกเลิก
                  </button>
                </span>
              ) : (
                <span className="em-block-tools">
                  <button
                    type="button"
                    className="em-btn sm icon-only ghost"
                    aria-label="เลื่อนขึ้น"
                    disabled={index === 0}
                    onClick={() => moveBlockBy(block.id, -1)}
                  >
                    <IconArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="em-btn sm icon-only ghost"
                    aria-label="เลื่อนลง"
                    disabled={index === blocks.length - 1}
                    onClick={() => moveBlockBy(block.id, 1)}
                  >
                    <IconArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="em-btn sm icon-only danger"
                    aria-label="ลบบล็อกนี้"
                    onClick={() => requestRemove(block.id)}
                  >
                    <IconTrash size={13} />
                  </button>
                </span>
              )}
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
      </div>
    </div>
  );
}
