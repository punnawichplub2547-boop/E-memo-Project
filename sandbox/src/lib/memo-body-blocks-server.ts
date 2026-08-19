// ด่านตรวจของ V3 — เดินตามรอย custom-route-server.ts คือไม่เชื่อ client เลย
// client ส่งอะไรมาก็ได้ ที่นี่คือจุดเดียวที่ตัดสินว่าอะไรลง DB ได้
//
// isBlockValid ตัวเก่า (ยุบไปแล้ว) แค่ cast raw object เป็น MemoBodyBlock หลังผ่านเช็ก —
// คีย์แปลกปลอมที่ client แนบมาด้วย (เช่น secretPayload) จะรอดไปลง body_blocks_json
// ทั้งที่คอมเมนต์บรรทัดบนบอกว่าที่นี่คือจุดเดียวที่ตัดสินใจ ดังนั้น validateBlock ด้านล่าง
// จึงต้อง "สร้างใหม่" ทุก block จากฟิลด์ที่ตรวจผ่านแล้วเท่านั้น ไม่ใช่ cast ของเดิม
import {
  MAX_TABLE_COLUMNS, hasSystemBlock,
  type MemoBodyBlock, type MemoFormMode, type SystemBlockRef,
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

type BlockResult =
  | { ok: true; block: MemoBodyBlock }
  | { ok: false; reason: string };

function fail(reason: string): BlockResult {
  return { ok: false, reason };
}

/**
 * Validates one untrusted block AND rebuilds it from only the fields its
 * declared `type` defines. A block that passes here is guaranteed to carry
 * no extra client-supplied keys (top-level or nested, e.g. inside
 * keyValue.pairs) into the returned object.
 */
function validateBlock(raw: unknown): BlockResult {
  if (typeof raw !== "object" || raw === null) return fail("บล็อกต้องเป็น object");
  const block = raw as Record<string, unknown>;
  if (typeof block.id !== "string" || block.id.length === 0) {
    return fail("บล็อกไม่มี id ที่ถูกต้อง");
  }
  const id = block.id;

  switch (block.type) {
    case "paragraph": {
      if (typeof block.text !== "string") {
        return fail("บล็อกย่อหน้าต้องมีข้อความเป็นสตริง");
      }
      return { ok: true, block: { id, type: "paragraph", text: block.text } };
    }
    case "table": {
      const { headers, rows } = block;
      if (!Array.isArray(headers) || headers.length === 0) {
        return fail("ตารางต้องมีอย่างน้อยหนึ่งคอลัมน์");
      }
      if (headers.length > MAX_TABLE_COLUMNS) {
        return fail(`ตารางมีคอลัมน์เกิน ${MAX_TABLE_COLUMNS} คอลัมน์`);
      }
      if (!headers.every((h) => typeof h === "string")) {
        return fail("หัวตารางต้องเป็นข้อความทั้งหมด");
      }
      if (!Array.isArray(rows)) {
        return fail("แถวของตารางต้องเป็น array");
      }
      const sanitizedRows: string[][] = [];
      for (const row of rows) {
        if (
          !Array.isArray(row) ||
          row.length !== headers.length ||
          !row.every((cell) => typeof cell === "string")
        ) {
          return fail("แถวในตารางต้องมีจำนวนคอลัมน์เท่ากับหัวตารางและเป็นข้อความทั้งหมด");
        }
        sanitizedRows.push(row.map((cell) => cell as string));
      }
      const sanitizedHeaders = headers.map((h) => h as string);
      return { ok: true, block: { id, type: "table", headers: sanitizedHeaders, rows: sanitizedRows } };
    }
    case "keyValue": {
      const { pairs } = block;
      if (!Array.isArray(pairs)) {
        return fail("keyValue ต้องมี pairs เป็น array");
      }
      const sanitizedPairs: { key: string; value: string }[] = [];
      for (const pair of pairs) {
        if (typeof pair !== "object" || pair === null) {
          return fail("คู่ key-value ต้องมี key และ value เป็นข้อความ");
        }
        const { key, value } = pair as Record<string, unknown>;
        if (typeof key !== "string" || typeof value !== "string") {
          return fail("คู่ key-value ต้องมี key และ value เป็นข้อความ");
        }
        sanitizedPairs.push({ key, value });
      }
      return { ok: true, block: { id, type: "keyValue", pairs: sanitizedPairs } };
    }
    case "system": {
      if (block.ref !== "requestItems" && block.ref !== "priceComparison") {
        return fail("บล็อกระบบอ้างอิงไม่ถูกต้อง");
      }
      const ref: SystemBlockRef = block.ref;
      return { ok: true, block: { id, type: "system", ref } };
    }
    default:
      return fail("ไม่รู้จักชนิดบล็อกนี้");
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

  const sanitized: MemoBodyBlock[] = [];
  for (const raw of blocks) {
    const result = validateBlock(raw);
    if (!result.ok) return invalid(result.reason);
    sanitized.push(result.block);
  }

  const seen = new Set<string>();
  for (const block of sanitized) {
    if (block.type !== "system") continue;
    if (seen.has(block.ref)) return invalid("บล็อกระบบซ้ำชนิดกัน");
    seen.add(block.ref);
  }

  return {
    status: "ok",
    formMode,
    blocks: sanitized,
    // ไม่มีบล็อกชี้ไปที่ข้อมูลไหน = ข้อมูลนั้นต้องถูกล้าง ไม่งั้นกลายเป็นข้อมูลผี
    clearPriceComparisons: !hasSystemBlock(sanitized, "priceComparison"),
    clearRequestItems: !hasSystemBlock(sanitized, "requestItems"),
  };
}
