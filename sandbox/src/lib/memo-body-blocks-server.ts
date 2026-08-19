// ด่านตรวจของ V3 — เดินตามรอย custom-route-server.ts คือไม่เชื่อ client เลย
// client ส่งอะไรมาก็ได้ ที่นี่คือจุดเดียวที่ตัดสินว่าอะไรลง DB ได้
import {
  MAX_TABLE_COLUMNS, hasSystemBlock,
  type MemoBodyBlock, type MemoFormMode,
} from "./memo-body-blocks";

export type BodyBlocksResolution =
  | {
      status: "ok";
      formMode: MemoFormMode;
      blocks: MemoBodyBlock[] | null;
      clearPriceComparisons: boolean;
      clearRequestItems: boolean;
    }
  | { status: "invalid"; reason: string };

function invalid(reason: string): BodyBlocksResolution {
  return { status: "invalid", reason };
}

function isBlockValid(raw: unknown): raw is MemoBodyBlock {
  if (typeof raw !== "object" || raw === null) return false;
  const block = raw as Record<string, unknown>;
  if (typeof block.id !== "string" || block.id.length === 0) return false;

  switch (block.type) {
    case "paragraph":
      return typeof block.text === "string";
    case "table": {
      const { headers, rows } = block;
      if (!Array.isArray(headers) || headers.length === 0) return false;
      if (headers.length > MAX_TABLE_COLUMNS) return false;
      if (!headers.every((h) => typeof h === "string")) return false;
      if (!Array.isArray(rows)) return false;
      return rows.every(
        (row) =>
          Array.isArray(row) &&
          row.length === headers.length &&
          row.every((cell) => typeof cell === "string")
      );
    }
    case "keyValue":
      return (
        Array.isArray(block.pairs) &&
        block.pairs.every(
          (pair) =>
            typeof pair === "object" && pair !== null &&
            typeof (pair as Record<string, unknown>).key === "string" &&
            typeof (pair as Record<string, unknown>).value === "string"
        )
      );
    case "system":
      return block.ref === "requestItems" || block.ref === "priceComparison";
    default:
      return false;
  }
}

export function resolveBodyBlocksFromRequest(input: {
  formMode: unknown;
  blocks: unknown;
  hasCustomRoute: boolean;
  existingFormMode?: MemoFormMode;
}): BodyBlocksResolution {
  const { formMode, blocks, hasCustomRoute, existingFormMode } = input;

  if (formMode !== "standard" && formMode !== "freeform") {
    return invalid("form_mode ต้องเป็น standard หรือ freeform");
  }
  // Q5: โหมดถูกล็อกไว้ตอนส่งครั้งแรก เปลี่ยนระหว่างแก้ไขไม่ได้
  if (existingFormMode && existingFormMode !== formMode) {
    return invalid("เปลี่ยนรูปแบบฟอร์มระหว่างแก้ไขไม่ได้");
  }

  if (formMode === "standard") {
    if (Array.isArray(blocks) && blocks.length > 0) {
      return invalid("ฟอร์มมาตรฐานต้องไม่มีบล็อกเนื้อหา");
    }
    return {
      status: "ok", formMode, blocks: null,
      clearPriceComparisons: false, clearRequestItems: false,
    };
  }

  // Q2: ฟอร์มอิสระบังคับเลือกผู้อนุมัติเอง
  if (!hasCustomRoute) return invalid("ฟอร์มอิสระต้องเลือกผู้อนุมัติเอง");
  if (!Array.isArray(blocks)) return invalid("bodyBlocks ต้องเป็น array");
  if (!blocks.every(isBlockValid)) return invalid("บล็อกเนื้อหาไม่ถูกต้อง");

  const valid = blocks as MemoBodyBlock[];
  const seen = new Set<string>();
  for (const block of valid) {
    if (block.type !== "system") continue;
    if (seen.has(block.ref)) return invalid("บล็อกระบบซ้ำชนิดกัน");
    seen.add(block.ref);
  }

  return {
    status: "ok",
    formMode,
    blocks: valid,
    // ไม่มีบล็อกชี้ไปที่ข้อมูลไหน = ข้อมูลนั้นต้องถูกล้าง ไม่งั้นกลายเป็นข้อมูลผี
    clearPriceComparisons: !hasSystemBlock(valid, "priceComparison"),
    clearRequestItems: !hasSystemBlock(valid, "requestItems"),
  };
}
