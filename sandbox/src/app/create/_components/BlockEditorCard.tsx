"use client";

import { useState, type ReactNode } from "react";
import type { UseBodyBlocksResult } from "../_hooks/useBodyBlocks";
import { blockHasContent } from "@/lib/memo-body-blocks";
import { IconArrowUp, IconArrowDown, IconTrash, IconCheck, IconX, IconFileText } from "@/components/icons";
import { ParagraphBlock } from "./blocks/ParagraphBlock";
import { TableBlock } from "./blocks/TableBlock";
import { KeyValueBlock } from "./blocks/KeyValueBlock";

const BLOCK_TITLE = {
  paragraph: "ย่อหน้า",
  table: "ตาราง",
  keyValue: "หัวข้อ–ค่า",
  system: "บล็อกระบบ",
} as const;

// M3 (UX review): both system blocks used to show the same "บล็อกระบบ" label,
// so Request Items and Price Comparison were indistinguishable in the list.
const SYSTEM_TITLE = {
  requestItems: "รายการที่ขอ",
  priceComparison: "ตารางเปรียบเทียบราคา",
} as const;

function blockLabel(block: { type: keyof typeof BLOCK_TITLE; ref?: keyof typeof SYSTEM_TITLE }) {
  return block.type === "system" && block.ref ? SYSTEM_TITLE[block.ref] : BLOCK_TITLE[block.type];
}

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
      {/* M4 (UX review): match the card-head pattern every other card on /create
          uses — icon chip + Thai/English + .em-sub. */}
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <IconFileText size={14} />
            </span>
            เนื้อหาเมโม / Memo Body
          </h3>
          <div className="em-sub" style={{ marginTop: 2 }}>
            เรียงบล็อกได้ตามต้องการ — ย่อหน้า ตาราง หัวข้อ–ค่า และการ์ดจากฟอร์มเดิม
          </div>
        </div>
      </div>
      <div className="em-card-body">
        {blocks.length === 0 ? (
          <div className="em-block-empty">
            <div className="em-block-empty-title">เริ่มเขียนเนื้อหาเมโม</div>
            <div className="em-block-empty-sub">
              เริ่มจากย่อหน้าหนึ่ง แล้วค่อยเพิ่มตาราง หัวข้อ–ค่า หรือการ์ดจากฟอร์มเดิม ตามลำดับที่ต้องการ
            </div>
            <button type="button" className="em-btn sm" onClick={() => addBlock("paragraph")}>
              + ย่อหน้า
            </button>
          </div>
        ) : null}

        {blocks.map((block, index) => (
          <div key={block.id} className="em-block">
            <header className="em-block-head">
              <span className="em-block-kind">{blockLabel(block)}</span>
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
                    aria-label={`ยืนยันลบบล็อก${blockLabel(block)}`}
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
                    {...(index === 0 ? { "aria-disabled": true } : {})}
                    onClick={() => moveBlockBy(block.id, -1)}
                  >
                    <IconArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="em-btn sm icon-only ghost"
                    aria-label="เลื่อนลง"
                    {...(index === blocks.length - 1 ? { "aria-disabled": true } : {})}
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
          <button type="button" className="em-btn sm" onClick={() => addBlock("paragraph")}>
            + ย่อหน้า
          </button>
          <button type="button" className="em-btn sm ghost" onClick={() => addBlock("table")}>
            + ตาราง
          </button>
          <button type="button" className="em-btn sm ghost" onClick={() => addBlock("keyValue")}>
            + หัวข้อ–ค่า
          </button>
          {/* M3: these two do not create content — they place a card the requester
              fills in elsewhere — so they are separated from the three above. */}
          <span className="em-block-add-divider" aria-hidden="true" />
          <button
            type="button"
            className="em-btn sm ghost"
            disabled={isSystemBlockUsed("priceComparison")}
            title={isSystemBlockUsed("priceComparison") ? "เพิ่มไว้ในเนื้อหาแล้ว" : undefined}
            onClick={() => addBlock("system", "priceComparison")}
          >
            + ตารางเปรียบเทียบราคา
          </button>
          <button
            type="button"
            className="em-btn sm ghost"
            disabled={isSystemBlockUsed("requestItems")}
            title={isSystemBlockUsed("requestItems") ? "เพิ่มไว้ในเนื้อหาแล้ว" : undefined}
            onClick={() => addBlock("system", "requestItems")}
          >
            + รายการที่ขอ
          </button>
        </div>
      </div>
    </div>
  );
}
