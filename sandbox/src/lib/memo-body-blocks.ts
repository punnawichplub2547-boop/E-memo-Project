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

/**
 * `useBodyBlocks().setFormMode("standard")` clears `blocks` unconditionally
 * (the server rejects a "standard" memo carrying bodyBlocks). Switching
 * *into* "standard" while blocks exist is the one data-loss case the UI
 * must confirm before committing — switching into "freeform", or into
 * "standard" with no blocks, is always safe to do immediately.
 */
export function shouldConfirmFormModeSwitch(targetMode: MemoFormMode, blockCount: number): boolean {
  return targetMode === "standard" && blockCount > 0;
}

/**
 * Does this block hold anything the requester would be upset to lose?
 *
 * Deleting a block is instant and there is no undo anywhere in the app, while
 * the far lighter "switch back to standard" already asks for confirmation
 * (shouldConfirmFormModeSwitch above). The editor uses this to protect the
 * blocks that matter without nagging about an empty one just added by mistake.
 *
 * A "system" block is always protected even though it carries no text of its
 * own: removing it makes the server null out the request-items or
 * price-comparison column it points at (resolveBodyBlocksFromRequest's clear*
 * flags), which is real data loss.
 */
export function blockHasContent(block: MemoBodyBlock): boolean {
  switch (block.type) {
    case "paragraph":
      return block.text.trim() !== "";
    case "table":
      return (
        block.headers.some((h) => h.trim() !== "") ||
        block.rows.some((row) => row.some((cell) => cell.trim() !== ""))
      );
    case "keyValue":
      return block.pairs.some((p) => p.key.trim() !== "" || p.value.trim() !== "");
    case "system":
      return true;
  }
}

export type TableBlockValue = { headers: string[]; rows: string[][] };
export type KeyValuePair = { key: string; value: string };

/** Renames one column header. Pure — returns a new value, never mutates `headers`/`rows`. */
export function setTableHeader(
  headers: string[],
  rows: string[][],
  index: number,
  value: string
): TableBlockValue {
  return { headers: headers.map((h, idx) => (idx === index ? value : h)), rows };
}

/** Edits one cell. Pure — returns a new value, never mutates `headers`/`rows`. */
export function setTableCell(
  headers: string[],
  rows: string[][],
  rowIndex: number,
  colIndex: number,
  value: string
): TableBlockValue {
  return {
    headers,
    rows: rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row
    ),
  };
}

/**
 * Adds one column, syncing the new empty cell into every existing row.
 * At the `MAX_TABLE_COLUMNS` cap this is a no-op — returns the same
 * `headers`/`rows` references unchanged, mirroring `moveBlock`'s
 * out-of-range behavior.
 */
export function addTableColumn(headers: string[], rows: string[][]): TableBlockValue {
  if (headers.length >= MAX_TABLE_COLUMNS) return { headers, rows };
  return { headers: [...headers, ""], rows: rows.map((row) => [...row, ""]) };
}

/** Appends one empty row, sized to the current column count. Pure. */
export function addTableRow(headers: string[], rows: string[][]): TableBlockValue {
  return { headers, rows: [...rows, headers.map(() => "")] };
}

/** Removes one row by index. Pure — never mutates `rows`. */
export function removeTableRow(headers: string[], rows: string[][], rowIndex: number): TableBlockValue {
  return { headers, rows: rows.filter((_, ri) => ri !== rowIndex) };
}

/**
 * Removes one column: the header at `index` plus the same index from every row.
 * Pure — never mutates `headers`/`rows`.
 *
 * Two no-ops, both returning the SAME references (mirroring `addTableColumn`'s
 * behavior at the cap, so a caller comparing identity can tell nothing happened):
 * an out-of-range index, and the last remaining column — a zero-column table has
 * no cell left to type into and prints as an empty block on the ISO form, so
 * "delete the whole block" is the action for that, not this.
 *
 * Rows shorter than `headers` are left alone past their end rather than padded:
 * `filter` on a ragged row simply keeps what is there.
 */
export function removeTableColumn(
  headers: string[],
  rows: string[][],
  index: number
): TableBlockValue {
  if (index < 0 || index >= headers.length || headers.length <= 1) return { headers, rows };
  return {
    headers: headers.filter((_, ci) => ci !== index),
    rows: rows.map((row) => row.filter((_, ci) => ci !== index)),
  };
}

/** Patches one key/value pair by index. Pure — never mutates `pairs`. */
export function setKeyValuePair(
  pairs: KeyValuePair[],
  index: number,
  patch: Partial<KeyValuePair>
): KeyValuePair[] {
  return pairs.map((pair, idx) => (idx === index ? { ...pair, ...patch } : pair));
}
