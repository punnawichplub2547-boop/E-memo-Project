import { newClientRowId } from "./client-row-id";

export type MemoFormMode = "standard" | "freeform";
export type SystemBlockRef = "requestItems" | "priceComparison";

export const MAX_TABLE_COLUMNS = 8;
/** เตือนผู้ใช้เมื่อเกินค่านี้ — ยังบันทึกได้ ต่างจาก MAX_TABLE_COLUMNS ที่เป็นเพดานจริง */
export const TABLE_COLUMN_WARN_AT = 6;

export type MemoBodyBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "table"; headers: string[]; rows: string[][] }
  | { id: string; type: "keyValue"; pairs: { key: string; value: string }[] }
  | { id: string; type: "system"; ref: SystemBlockRef };

export function createBlock(
  type: MemoBodyBlock["type"],
  ref: SystemBlockRef = "priceComparison"
): MemoBodyBlock {
  const id = newClientRowId();
  switch (type) {
    case "paragraph":
      return { id, type: "paragraph", text: "" };
    case "table":
      return { id, type: "table", headers: [""], rows: [[""]] };
    case "keyValue":
      return { id, type: "keyValue", pairs: [{ key: "", value: "" }] };
    case "system":
      return { id, type: "system", ref };
  }
}

export function moveBlock(
  blocks: MemoBodyBlock[],
  from: number,
  to: number
): MemoBodyBlock[] {
  if (from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function removeBlock(blocks: MemoBodyBlock[], id: string): MemoBodyBlock[] {
  return blocks.filter((block) => block.id !== id);
}

export function hasSystemBlock(blocks: MemoBodyBlock[], ref: SystemBlockRef): boolean {
  return blocks.some((block) => block.type === "system" && block.ref === ref);
}
