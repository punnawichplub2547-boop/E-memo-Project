// Builds an .xlsx replica of the paper "INTERNAL MEMO" form (F-DC-006) from a MemoRecord.
// Pure function: no DB/fs access except reading the static logo asset shipped in public/.
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ApprovalLevel, ApprovalStepKey, MemoRecord } from "../approval";
import { approvalLabels, computePriceRowTotals } from "../approval";
import { describeCustomStep } from "../custom-route";
import { buildCustomSignatureSlots, type SignatureSlot } from "./memo-signature-slots";
import { safeSpreadsheetText } from "./excel-safe-text";
import { spanColumns, FORM_COL_WIDTHS } from "./span-columns";

export type MemoSignature = {
  // Either a Book1 approval level or a custom route's person token — the same
  // string that workflow_step_actions.step_label stores.
  stepLabel: ApprovalStepKey;
  actorName: string;
  actedAt: string;
};

const THAI_FONT = "Tahoma";
// C1 (Ruling 4, Task 4 review): column widths used to be declared a second time here
// (`colWidths`, independently of span-columns.ts's FORM_COL_WIDTHS) with no import linking
// the two — they happened to still match, but nothing would catch a future edit to only one
// copy. FORM_COL_WIDTHS is now the single source; TOTAL_COLS derives from it.
const TOTAL_COLS = FORM_COL_WIDTHS.length;

// Row-major layout of the form's 24 "To:" checkboxes (3 columns x 8 rows), top-to-bottom
// then left-to-right, matching Form.jpg exactly. MD/SGM/GM are approval-role boxes with no
// equivalent in DEPARTMENTS (src/lib/departments.ts) — they simply never get checked here.
const DEPT_GRID: string[][] = [
  ["MD", "MK", "MT"],
  ["SGM", "QA/QC", "PD"],
  ["GM", "R&D", "MIX"],
  ["FM", "PU", "CUT"],
  ["HR&GA", "PC", "FMG"],
  ["ACC/FIN", "LGT", "FNG/NT"],
  ["DC", "EN", "EXT"],
  ["IT", "PE", "PLA"],
];

type CellOpts = {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  wrap?: boolean;
  color?: string;
  fill?: string;
  border?: boolean;
};

function styleCell(cell: ExcelJS.Cell, opts: CellOpts = {}) {
  cell.font = {
    name: THAI_FONT,
    size: opts.size ?? 10,
    bold: !!opts.bold,
    italic: !!opts.italic,
    color: opts.color ? { argb: opts.color } : undefined,
  };
  cell.alignment = {
    horizontal: opts.align ?? "left",
    vertical: opts.valign ?? "middle",
    wrapText: !!opts.wrap,
  };
  if (opts.border !== false) {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }
  if (opts.fill) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
  }
}

function mergeRange(ws: ExcelJS.Worksheet, startCol: number, endCol: number, row: number): string {
  const start = ws.getColumn(startCol).letter + row;
  const end = ws.getColumn(endCol).letter + row;
  if (startCol !== endCol) ws.mergeCells(`${start}:${end}`);
  return start;
}

function setRange(
  ws: ExcelJS.Worksheet,
  startCol: number,
  endCol: number,
  row: number,
  value: string | number | null,
  opts: CellOpts = {},
): ExcelJS.Cell {
  const ref = mergeRange(ws, startCol, endCol, row);
  const cell = ws.getCell(ref);
  cell.value = value;
  styleCell(cell, opts);
  return cell;
}

function money(n: number | undefined | null): number {
  return Math.round((n ?? 0) * 100) / 100;
}

// Sum the configured widths of a merged column range (Excel "width" units).
function rangeWidth(ws: ExcelJS.Worksheet, startCol: number, endCol: number): number {
  let w = 0;
  for (let c = startCol; c <= endCol; c++) w += ws.getColumn(c).width ?? 9;
  return w;
}

// Excel's own ceiling for a row's height, in points (Global Constraints: "ความสูงแถวห้ามเกิน
// 409 point"). fitRowHeight is the single function that ever sets `ws.getRow(row).height` in
// this file, so this is the invariant's one correct home (Ruling 16, Task 11 fix round 1) —
// every caller (paragraph chunks, free-form table cells, key-value values, item names,
// vendor remarks, the budget title, ...) is protected by one change instead of each caller
// needing its own guard. The cap only bounds the *rendered row height* — the full text
// always stays in the cell (visible in the formula bar / on manual row-resize); nothing here
// truncates content, only how tall Excel is told to draw the row.
const MAX_EXCEL_ROW_HEIGHT = 409;

// ---- Task 12: repeat the ISO header on every printed page, and keep the signature block
// from being split across a page boundary. ----
//
// C1 (carry-in): the task brief's own sample assumed a flat "16pt/row, 44 rows per page"
// estimate to decide where content sits on the page. That assumption predates Task 11, which
// made row height content-driven — a single 1200-char paragraph chunk in a free-form memo can
// already be ~384pt tall (24 wrapped lines), so counting *rows* instead of *points* would be
// off by more than an order of magnitude on exactly the documents this feature exists to
// protect. contentHeightBeforeRow() below sums the REAL heights fitRowHeight already assigned
// (falling back to Excel's own default for any row it never touched), so the "how much of the
// page is already used" side of the estimate tracks Task 11's variable row heights instead of
// pretending they are all 16pt.
//
// The signature block's OWN height is still a small constant (SIGNATURE_BLOCK_HEIGHT_ESTIMATE_
// POINTS) rather than measured the same way — unlike body content, its rows never hold
// requester-typed paragraphs (labels/names/dates are short, single-line values), so headerCell's
// own fitRowHeight call on the one label row it draws will realistically clamp to its 16pt
// minimum every time. Using rowCount * DEFAULT_ROW_HEIGHT_POINTS here is a deliberate, bounded
// approximation, not the same shortcut C1 flags — it is also a safe overestimate for the
// standard 3-row block (Supervisor/Manager/... header+name+date), since 5 rows covers the
// custom-route block's worst case (label + subLabel + name + date + hidden-count note).
//
// Per C2, none of this predicts where Excel actually paginates — only Excel's renderer does
// that. What we control and can test is: did OUR estimate decide the block was at risk and
// insert a manual break (`Row.addPageBreak()`, confirmed present on this ExcelJS version — see
// task-12-report.md) before it. A false "no risk" only ever costs a possibly-split block (no
// worse than before Task 12); a false "at risk" only ever costs one early page break — neither
// failure mode is silent data loss, which is why an estimate is an acceptable trade-off here.
const PAGE_PRINTABLE_HEIGHT_POINTS = 700; // A4 portrait, default ~0.75in top/bottom margins.
const DEFAULT_ROW_HEIGHT_POINTS = 15; // ExcelJS's own default for a row fitRowHeight never set.
const SIGNATURE_BLOCK_HEIGHT_ESTIMATE_POINTS = 5 * DEFAULT_ROW_HEIGHT_POINTS;

// Rows 1-3 (company header + ISO badge) repeat on every physical page via printTitlesRow, so
// they consume printable height on EVERY page, not just the first. Read from the heights
// already set at the top of buildMemoExcelWorkbook rather than hardcoded, so a future header
// change is picked up automatically instead of silently going stale.
function repeatedHeaderHeightPoints(ws: ExcelJS.Worksheet): number {
  let h = 0;
  for (let i = 1; i <= 3; i++) h += ws.getRow(i).height ?? DEFAULT_ROW_HEIGHT_POINTS;
  return h;
}

// Sum of the real heights of every row already drawn between the repeated header (rows 1-3)
// and `beforeRow` (exclusive) — see the block comment above for why this must be actual
// heights, not a flat per-row constant.
function contentHeightBeforeRow(ws: ExcelJS.Worksheet, beforeRow: number): number {
  let h = 0;
  for (let i = 4; i < beforeRow; i++) h += ws.getRow(i).height ?? DEFAULT_ROW_HEIGHT_POINTS;
  return h;
}

// ExcelJS does not auto-fit row height for wrapped text, so long Thai strings spill out of
// their cell. Estimate the wrapped line count for `text` inside the merged range and grow the
// row so nothing clips. We under-estimate chars-per-line on purpose (taller is safe, clipped
// is not). Never shrinks a row that another column already made taller.
//
// Thai (and other scripts without spaces) pack far fewer glyphs per column-width unit than
// Latin digits — Tahoma Thai is wide and stacked vowels/tone marks add visual height — so
// any text containing Thai uses a lower density and taller line height. fitToWidth print
// scaling also shrinks columns at render time, which only ever needs MORE lines than the
// natural-width estimate, so erring tall is correct.
function fitRowHeight(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string | number | null | undefined,
  startCol: number,
  endCol: number,
  opts: { lineHeight?: number; minHeight?: number; fontSize?: number } = {},
): void {
  const str = String(text ?? "");
  const hasThai = /[฀-๿]/.test(str);
  const lineHeight = opts.lineHeight ?? (hasThai ? 16 : 15);
  const density = hasThai ? 0.5 : 0.8;
  const fontScale = (opts.fontSize ?? 10) / 10;
  const charsPerLine = Math.max(1, Math.floor((rangeWidth(ws, startCol, endCol) / fontScale) * density));
  let lines = 0;
  for (const segment of str.split("\n")) {
    lines += Math.max(1, Math.ceil(segment.length / charsPerLine));
  }
  const needed = Math.min(Math.max(lines * lineHeight, opts.minHeight ?? lineHeight), MAX_EXCEL_ROW_HEIGHT);
  ws.getRow(row).height = Math.min(Math.max(ws.getRow(row).height ?? 0, needed), MAX_EXCEL_ROW_HEIGHT);
}

// A bordered, shaded, centered table header. Long Thai headers (e.g. "รวมราคาขาย/บริการ
// ทั้งสิ้น") are wider than their merged column span, so without wrapText they spill past the
// cell's right border into the neighbouring column — and with gridlines hidden, that border is
// the only visible frame, so the overflow reads as "ฟอนต์เลยกรอบ". Wrapping keeps the text
// inside the frame; fitRowHeight then grows the row so the extra line is not clipped.
function headerCell(ws: ExcelJS.Worksheet, startCol: number, endCol: number, row: number, text: string): void {
  setRange(ws, startCol, endCol, row, text, { bold: true, align: "center", wrap: true, fill: "FFF1F5F9" });
  fitRowHeight(ws, row, text, startCol, endCol, { minHeight: 16 });
}

function findSignature(signatures: MemoSignature[], stepLabel: ApprovalLevel): MemoSignature | undefined {
  const matches = signatures.filter((s) => s.stepLabel === stepLabel);
  return matches[matches.length - 1];
}

// ---- Request items table (Task 11 Step 3: extracted verbatim from the pre-existing inline
// code, no behavior change — "keeps a standard memo's layout unchanged" depends on this). ----
function renderItemsTable(ws: ExcelJS.Worksheet, memo: MemoRecord, startRow: number): number {
  let r = startRow;
  headerCell(ws, 1, 1, r, "ลำดับ");
  headerCell(ws, 2, 6, r, "รายการ");
  headerCell(ws, 7, 7, r, "หน่วย");
  headerCell(ws, 8, 8, r, "จำนวน");
  headerCell(ws, 9, 10, r, "ราคา/หน่วย");
  headerCell(ws, 11, 12, r, "รวมเป็นเงิน");
  r++;

  const items = memo.requestItems ?? [];
  let itemSubtotal = 0;
  if (items.length === 0) {
    setRange(ws, 1, 1, r, 1, { align: "center" });
    setRange(ws, 2, 6, r, "(ไม่มีรายการ)", {});
    setRange(ws, 7, 7, r, "-", { align: "center" });
    setRange(ws, 8, 8, r, "-", { align: "center" });
    setRange(ws, 9, 10, r, "-", { align: "center" });
    setRange(ws, 11, 12, r, money(memo.amount), { align: "right" }).numFmt = "#,##0.00";
    itemSubtotal = money(memo.amount);
    r++;
  } else {
    items.forEach((item, i) => {
      const total = item.qty * item.unitPrice;
      itemSubtotal += total;
      setRange(ws, 1, 1, r, i + 1, { align: "center" });
      setRange(ws, 2, 6, r, item.name, { wrap: true });
      fitRowHeight(ws, r, item.name, 2, 6, { minHeight: 16 });
      setRange(ws, 7, 7, r, item.unit, { align: "center" });
      setRange(ws, 8, 8, r, item.qty, { align: "center" });
      setRange(ws, 9, 10, r, money(item.unitPrice), { align: "right" }).numFmt = "#,##0.00";
      setRange(ws, 11, 12, r, money(total), { align: "right" }).numFmt = "#,##0.00";
      r++;
    });
  }

  setRange(ws, 1, 9, r, "รวมเป็นเงิน", { align: "right", border: false });
  setRange(ws, 10, 12, r, money(itemSubtotal), { align: "right" }).numFmt = "#,##0.00"; r++;
  setRange(ws, 1, 9, r, "ส่วนลด (ถ้ามี)", { align: "right", border: false });
  setRange(ws, 10, 12, r, 0, { align: "right" }).numFmt = "#,##0.00"; r++;
  setRange(ws, 1, 9, r, "ภาษีมูลค่าเพิ่ม VAT 7%", { align: "right", border: false });
  setRange(ws, 10, 12, r, 0, { align: "right" }).numFmt = "#,##0.00"; r++;
  setRange(ws, 1, 9, r, "รวมเป็นเงินทั้งสิ้น", { align: "right", bold: true, border: false });
  setRange(ws, 10, 12, r, money(itemSubtotal), { align: "right", bold: true }).numFmt = "#,##0.00"; r++;
  return r;
}

// ---- Budget table — not a block in either mode (design spec §6.1: "บล็อกงบ → ปิดท้าย →
// ช่องเซ็น ← ไม่เปลี่ยน"), so it is its own function shared by both the standard and
// free-form branches of buildMemoExcelWorkbook rather than being duplicated in each. ----
function renderBudgetTable(ws: ExcelJS.Worksheet, memo: MemoRecord, startRow: number): number {
  let r = startRow;
  headerCell(ws, 1, 1, r, "ลำดับ");
  headerCell(ws, 2, 4, r, "รายการ");
  headerCell(ws, 5, 6, r, "Budget Plan 2025");
  headerCell(ws, 7, 8, r, "Budget ที่ใช้ไป");
  headerCell(ws, 9, 10, r, "Budget ที่ขอใช้");
  headerCell(ws, 11, 12, r, "Budget คงเหลือ");
  r++;
  const budgetPlan = memo.budgetPlan;
  const budgetUsed = memo.budgetUsed ?? 0;
  const remaining = budgetPlan !== undefined ? budgetPlan - budgetUsed - memo.amount : undefined;
  setRange(ws, 1, 1, r, 1, { align: "center" });
  setRange(ws, 2, 4, r, memo.title, { wrap: true, valign: "top" });
  fitRowHeight(ws, r, memo.title, 2, 4, { minHeight: 16 });
  setRange(ws, 5, 6, r, budgetPlan !== undefined ? money(budgetPlan) : "-", { align: "right" });
  setRange(ws, 7, 8, r, money(budgetUsed), { align: "right" });
  setRange(ws, 9, 10, r, money(memo.amount), { align: "right" });
  setRange(ws, 11, 12, r, remaining !== undefined ? money(remaining) : "-", { align: "right" });
  r++;
  return r;
}

// ---- Price comparison table (Task 11 Step 3: extracted verbatim, no behavior change). ----
function renderPriceTable(ws: ExcelJS.Worksheet, memo: MemoRecord, startRow: number): number {
  let r = startRow;
  headerCell(ws, 1, 1, r, "ลำดับ");
  headerCell(ws, 2, 5, r, "ผู้ให้บริการ");
  headerCell(ws, 6, 7, r, "ราคาเสนอ");
  headerCell(ws, 8, 9, r, "ส่วนลด (ถ้ามี)");
  headerCell(ws, 10, 11, r, "รวมราคาขาย/บริการทั้งสิ้น");
  headerCell(ws, 12, 12, r, "หมายเหตุ");
  r++;
  const vendors = memo.priceComparisons ?? [];
  const vendorRowCount = Math.max(vendors.length, 3);
  for (let i = 0; i < vendorRowCount; i++) {
    const v = vendors[i];
    setRange(ws, 1, 1, r, i + 1, { align: "center" });
    if (v) {
      const { netPrice } = computePriceRowTotals(v);
      const selected = v.isSelected ? " (เลือกใช้บริการ)" : "";
      const vendorLabel = `${v.vendorName}${selected}`;
      setRange(ws, 2, 5, r, vendorLabel, { bold: !!v.isSelected, wrap: true, valign: "top" });
      setRange(ws, 6, 7, r, money(v.offeredPrice), { align: "right" });
      setRange(ws, 8, 9, r, money(v.discount), { align: "right" });
      setRange(ws, 10, 11, r, money(netPrice), { align: "right" });
      setRange(ws, 12, 12, r, v.remark ?? "", { wrap: true, valign: "top" });
      fitRowHeight(ws, r, vendorLabel, 2, 5, { minHeight: 16 });
      fitRowHeight(ws, r, v.remark ?? "", 12, 12, { minHeight: 16 });
    } else {
      setRange(ws, 2, 5, r, "", {});
      setRange(ws, 6, 7, r, "", {});
      setRange(ws, 8, 9, r, "", {});
      setRange(ws, 10, 11, r, "", {});
      setRange(ws, 12, 12, r, "", {});
    }
    r++;
  }
  return r;
}

// Row height must never exceed Excel's ~409 point ceiling (fitRowHeight has no cap of its
// own — see its doc comment). At the form's full 12-column width a 1200-char Thai chunk
// estimates to ~384pt (24 lines × 16pt), leaving headroom; verified empirically by the
// "cuts pure Thai text… at exactly the 1200-char boundary" and "…no row exceeds…" tests
// below, not by trusting this number in isolation (C3#2).
const MAX_PARAGRAPH_CHARS = 1200;

/**
 * Splits `text` into chunks no longer than `size`, preferring to cut at a space.
 * C3#1: Thai is written with no spaces between words, so `lastIndexOf(" ", size)` returns
 * -1 for pure-Thai input and every chunk lands exactly at the `size` boundary — confirmed
 * intentional/acceptable and proven with a dedicated Thai-only test rather than assumed.
 */
function chunkText(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = rest.lastIndexOf(" ", size);
    const at = cut > size * 0.5 ? cut : size;
    chunks.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

/**
 * H1: shrinks `cells` to at most `spanCount` entries so it can always be zipped 1:1 with a
 * `spanColumns()` result, even when the caller's data has more entries than spans has
 * groups (spanColumns clamps at MAX_TABLE_COLUMNS). The overflow is folded into the last
 * kept entry (joined with " / "), not dropped — no value the requester typed disappears
 * from the exported file, it just shares a cell with its neighbours instead of crashing
 * the export. A no-op (same array) when `cells.length <= spanCount`, which is every table
 * the current server validator allows through.
 */
function collapseToSpanCount(cells: string[], spanCount: number): string[] {
  if (cells.length <= spanCount || spanCount <= 0) return cells;
  const kept = cells.slice(0, spanCount - 1);
  const overflow = cells.slice(spanCount - 1).join(" / ");
  return [...kept, overflow];
}

// ---- Free-form body: draws each block in the order the requester arranged them (design
// spec §6.2). `system` blocks are pointers, not a copy of the data (§4.4) — they call the
// same renderItemsTable/renderPriceTable used by standard mode, so the underlying
// price/request-item data (and its VAT math, selected-vendor flag, etc.) never needs a
// second implementation. Every free-typed string goes through safeSpreadsheetText() —
// unlike the fixed standard-mode tables, this surface lets the requester type into
// arbitrarily many cells, so formula injection (§7.1) is a real risk here.
function renderBodyBlocks(ws: ExcelJS.Worksheet, memo: MemoRecord, startRow: number): number {
  let r = startRow;
  for (const block of memo.bodyBlocks ?? []) {
    switch (block.type) {
      case "paragraph": {
        for (const chunk of chunkText(block.text, MAX_PARAGRAPH_CHARS)) {
          const text = safeSpreadsheetText(chunk);
          setRange(ws, 1, TOTAL_COLS, r, text, { wrap: true });
          fitRowHeight(ws, r, text, 1, TOTAL_COLS, { minHeight: 16 });
          r++;
        }
        break;
      }
      case "table": {
        // H1 (Task 11 fix round 1): spanColumns() clamps at MAX_TABLE_COLUMNS (8), so if
        // block.headers (or an individual row — data can drift from headers independently)
        // is ever longer than that, `spans` is shorter than the array being indexed and
        // `spans[i]` is undefined past its end. The live write path
        // (memo-body-blocks-server.ts) already rejects >8 headers before persist, but the
        // export layer must not silently trust that upstream guarantee — a legacy row, a
        // seed fixture, or a future validator refactor could still hand this function more
        // columns than spans can address, and `spans[i][0]` would throw, 500-ing the whole
        // export instead of degrading. Fold any overflow into the last visible column
        // (joined with " / ") rather than truncating — every value the requester typed
        // stays visible in the exported file, just consolidated into one cell.
        const spans = spanColumns(block.headers.length);
        const headers = collapseToSpanCount(block.headers, spans.length);
        headers.forEach((header, i) =>
          headerCell(ws, spans[i][0], spans[i][1], r, safeSpreadsheetText(header))
        );
        r++;
        for (const row of block.rows) {
          const cells = collapseToSpanCount(row, spans.length);
          cells.forEach((cell, i) => {
            const text = safeSpreadsheetText(cell);
            setRange(ws, spans[i][0], spans[i][1], r, text, { wrap: true });
            fitRowHeight(ws, r, text, spans[i][0], spans[i][1], { minHeight: 16 });
          });
          r++;
        }
        break;
      }
      case "keyValue": {
        for (const pair of block.pairs) {
          const value = safeSpreadsheetText(pair.value);
          setRange(ws, 1, 3, r, safeSpreadsheetText(pair.key), { bold: true });
          setRange(ws, 4, TOTAL_COLS, r, value, { wrap: true });
          fitRowHeight(ws, r, value, 4, TOTAL_COLS, { minHeight: 16 });
          r++;
        }
        break;
      }
      case "system":
        r = block.ref === "priceComparison" ? renderPriceTable(ws, memo, r) : renderItemsTable(ws, memo, r);
        break;
    }
  }
  return r;
}

export async function buildMemoExcelWorkbook(
  memo: MemoRecord,
  signatures: MemoSignature[] = [],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HR&GA E-Memo";
  wb.created = new Date();

  const ws = wb.addWorksheet("Memo", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      // Q6 — the ISO company header (rows 1-3) must appear on every printed page, not just
      // the first, once a long free-form body pushes the memo past one physical page.
      printTitlesRow: "1:3",
    },
    // &P = current page number, &N = total page count (ExcelJS/Excel header-footer codes).
    headerFooter: { oddFooter: "&Rหน้า &P จาก &N" },
    views: [{ showGridLines: false }],
  });

  // NOTE: ExcelJS 4.4.0 treats a width of exactly 9 as its internal default and omits
  // it from the saved file, so any column left at 9 silently falls back to Excel's
  // default width and Thai text overflows. Every width here is deliberately != 9.
  // Layout: narrow index (col 1), wider left meta / item columns (2-3), money columns
  // on the right (9-12). Sum ~102 fits one A4 portrait page (pageSetup fitToWidth: 1).
  // Single source of truth: FORM_COL_WIDTHS (span-columns.ts) — see C1 above.
  FORM_COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // ---- Header: logo + company name + ISO badge ----
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 18;
  try {
    const logoPath = path.join(process.cwd(), "public", "CARLOGO.png");
    const logoBuffer = readFileSync(logoPath);
    // exceljs's bundled .d.ts declares its own ambient `Buffer` that merges oddly
    // with newer @types/node's generic Buffer<ArrayBufferLike> — no clean cast
    // satisfies both, so this one boundary call is untyped.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageId = wb.addImage({ buffer: logoBuffer, extension: "png" } as any);
    ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 58 } });
  } catch {
    // Logo asset missing — header text still renders, just without the image.
  }
  setRange(ws, 4, 9, 1, "บริษัท คอมพลีท ออโต รับเบอร์ แมนูแฟคเจอริ่ง จำกัด", {
    bold: true, size: 13, align: "center", border: false,
  });
  setRange(ws, 4, 9, 2, "COMPLETE AUTO RUBBER MANUFACTURING CO., LTD.", {
    bold: true, size: 11, align: "center", color: "FF1D4ED8", border: false,
  });
  setRange(ws, 4, 9, 3, "", { border: false });
  setRange(ws, 10, 12, 1, "CERTIFIED", { size: 8, align: "center", bold: true });
  setRange(ws, 10, 12, 2, "ISO 9001 / ISO 14001", { size: 8, align: "center" });
  setRange(ws, 10, 12, 3, "IATF 16949", { size: 8, align: "center" });

  // ---- INTERNAL MEMO title + meta fields (left) + 24 dept checkboxes (right, 3x8) ----
  const gridStartRow = 4;
  setRange(ws, 1, 3, gridStartRow, "INTERNAL MEMO", { bold: true, size: 12, align: "center", fill: "FFE5EDFF" });
  const metaRows: Array<[string, string]> = [
    ["Ref.No", memo.id],
    ["Date", memo.createdAt],
    ["From (ผู้จัดทำเอกสาร)", memo.requester],
    ["To (ผู้บังคับบัญชา)", describeCustomStep(memo.currentStep, memo.customRoute, memo.selectedRoute?.length)],
    ["Subject", memo.title],
    ["Category", approvalLabels[memo.category] ?? memo.category],
    ["Subcategory", memo.itemSubcategoryLabel ?? "-"],
    ["Attachment", memo.attachments && memo.attachments.length > 0 ? `${memo.attachments.length} ไฟล์` : "-"],
  ];
  metaRows.forEach(([label, value], i) => {
    const row = gridStartRow + 1 + i;
    const text = `${label}: ${value}`;
    setRange(ws, 1, 3, row, text, { size: 9, wrap: true });
    fitRowHeight(ws, row, text, 1, 3, { fontSize: 9, minHeight: 16 });
  });

  DEPT_GRID.forEach((cols, i) => {
    const row = gridStartRow + i;
    cols.forEach((code, colIdx) => {
      const startCol = 4 + colIdx * 3;
      const checked = code === memo.department;
      setRange(ws, startCol, startCol + 2, row, `${checked ? "☑" : "☐"} ${code}`, {
        bold: checked,
        fill: checked ? "FFFFF3B0" : undefined,
      });
    });
  });

  // ---- Body narrative ----
  let r = gridStartRow + Math.max(DEPT_GRID.length, metaRows.length + 1);
  setRange(ws, 1, TOTAL_COLS, r, "เรียน ผู้บังคับบัญชาตามสายงานอนุมัติ", { size: 10 }); r++;
  const subjectText = `เรื่อง: ${memo.title}`;
  setRange(ws, 1, TOTAL_COLS, r, subjectText, { bold: true, size: 10.5, wrap: true, valign: "top" });
  fitRowHeight(ws, r, subjectText, 1, TOTAL_COLS, { fontSize: 10.5, minHeight: 16 }); r++;
  const reasonText = `เนื่องจาก/เหตุผล: ${memo.description ?? "-"}`;
  setRange(ws, 1, TOTAL_COLS, r, reasonText, { size: 10, wrap: true, valign: "top" });
  fitRowHeight(ws, r, reasonText, 1, TOTAL_COLS, { minHeight: 32 }); r++;

  // ---- Body: free-form blocks in the order the requester arranged them, or the fixed
  // request-items table. The budget table is never a block (design spec §6.1 — it "closes
  // out" the body in both modes) so it always renders next, unconditionally. The price
  // table only renders unconditionally in standard mode; in free-form mode it renders (at
  // most once) wherever the requester placed a `system` block pointing at it — see
  // renderBodyBlocks below. This is invariant C4: never print the items/price table twice.
  if (memo.formMode === "freeform") {
    r = renderBodyBlocks(ws, memo, r);
  } else {
    r = renderItemsTable(ws, memo, r);
  }

  r++;
  r = renderBudgetTable(ws, memo, r);

  if (memo.formMode !== "freeform") {
    r++;
    r = renderPriceTable(ws, memo, r);
  }

  // ---- Closing two-column block ----
  // Matches the paper form (Form.jpg): a free-form note (หมายเหตุ / closing remark) on the
  // left, parallel to the "ขอแสดงความนับถือ" + requester identity block on the right.
  r++;
  setRange(ws, 1, TOTAL_COLS, r, "จึงเรียนมาเพื่อทราบและโปรดพิจารณาอนุมัติ", { align: "center", border: false }); r++;

  const blockTop = r;
  // Right column: regards + requester name + department/position
  setRange(ws, 7, 12, blockTop, "ขอแสดงความนับถือ", { align: "center", border: false });
  setRange(ws, 7, 12, blockTop + 1, memo.requester, { align: "center", border: false });
  setRange(ws, 7, 12, blockTop + 2, `(${memo.requester})`, { align: "center", border: false });
  setRange(ws, 7, 12, blockTop + 3, memo.department, { align: "center", border: false, size: 9 });
  // Left column: หมายเหตุ — one tall cell merged vertically across the 4 regards rows.
  ws.mergeCells(blockTop, 1, blockTop + 3, 6);
  const noteCell = ws.getCell(blockTop, 1);
  noteCell.value = memo.closingRemark ? `หมายเหตุ: ${memo.closingRemark}` : "";
  styleCell(noteCell, { align: "left", valign: "top", wrap: true, border: false, color: "FFB91C1C", bold: true });
  r = blockTop + 4;

  // ---- Signature block: Supervisor / Dept Manager / GM / Sr.GM / MD ----
  // The prototype's approval engine only models 3 levels (Manager / Top Section, General
  // Manager, Managing Director) — Supervisor and Sr.General Manager have no workflow
  // equivalent and are always left blank for a human wet-signature.
  r++;

  // Task 12 Step 4 (C1-adjusted): if too little of the current printed page remains for the
  // whole signature block, force it onto a fresh page rather than let Excel split it — a
  // signature row landing alone at the top of the next page, separated from its label row,
  // reads as broken far worse than an early page break. See the block comment above
  // PAGE_PRINTABLE_HEIGHT_POINTS for why this measures real accumulated row height instead of
  // counting rows.
  const usablePageHeight = PAGE_PRINTABLE_HEIGHT_POINTS - repeatedHeaderHeightPoints(ws);
  const consumedOnCurrentPage = contentHeightBeforeRow(ws, r) % usablePageHeight;
  const remainingOnCurrentPage = usablePageHeight - consumedOnCurrentPage;
  if (remainingOnCurrentPage < SIGNATURE_BLOCK_HEIGHT_ESTIMATE_POINTS) {
    ws.getRow(r - 1).addPageBreak();
  }

  // Column spans are shared by both modes so the printed layout never moves (Q21).
  const SIG_SPANS: Array<[number, number]> = [[1, 2], [3, 4], [5, 7], [8, 9], [10, 12]];
  const customSlots =
    memo.customRoute && memo.customRoute.length > 0
      ? buildCustomSignatureSlots(memo.customRoute, signatures)
      : null;

  if (customSlots) {
    // Custom per-person route: the 5 columns carry the people the requester chose
    // rather than the fixed org tiers, so each column needs a second line naming
    // the level and the role — without it a reader cannot tell who merely checked
    // the memo from who approved it.
    // Bound outside the callbacks below: TS drops the null-narrowing of customSlots
    // once it is only referenced from inside a closure.
    const slots = customSlots.slots;
    const eachSpan = (fn: (span: [number, number], slot: SignatureSlot | undefined) => void) =>
      SIG_SPANS.forEach((span, i) => fn(span, slots[i]));

    eachSpan(([from, to], slot) => headerCell(ws, from, to, r, slot?.label ?? ""));
    r++;
    eachSpan(([from, to], slot) =>
      setRange(ws, from, to, r, slot?.subLabel ?? "", { align: "center", size: 8.5 }));
    r++;
    eachSpan(([from, to], slot) =>
      setRange(ws, from, to, r, slot ? (slot.signature ? `(${slot.signature.actorName})` : "(...ชื่อ-สกุล...)") : "", { align: "center" }));
    r++;
    eachSpan(([from, to], slot) =>
      setRange(ws, from, to, r, slot ? (slot.signature ? `Date: ${slot.signature.actedAt}` : "Date: ____________") : "", { align: "center", size: 9 }));
    r++;
    if (customSlots.hiddenCount > 0) {
      // Q24: the sheet is a summary once the route outgrows 5 columns; say so
      // rather than letting the reader assume these 5 are the whole route.
      setRange(ws, 1, TOTAL_COLS, r,
        `หมายเหตุ: มีผู้อนุมัติเพิ่มอีก ${customSlots.hiddenCount} คน ดูรายชื่อทั้งหมดในระบบ E-Memo`,
        { align: "left", italic: true, size: 8.5, border: false });
      r++;
    }
  } else {
    const deptManagerSig = findSignature(signatures, "Manager / Top Section");
    const gmSig = findSignature(signatures, "General Manager");
    const mdSig = findSignature(signatures, "Managing Director");
    const sigCols: Array<[number, number, string, MemoSignature | undefined]> = [
      [1, 2, "Supervisor", undefined],
      [3, 4, "Department Manager", deptManagerSig],
      [5, 7, "General Manager", gmSig],
      [8, 9, "Sr.General Manager", undefined],
      [10, 12, "Managing Director", mdSig],
    ];
    sigCols.forEach(([from, to, label]) => headerCell(ws, from, to, r, label));
    r++;
    sigCols.forEach(([from, to, , sig]) => setRange(ws, from, to, r, sig ? `(${sig.actorName})` : "(...ชื่อ-สกุล...)", { align: "center" }));
    r++;
    sigCols.forEach(([from, to, , sig]) => setRange(ws, from, to, r, sig ? `Date: ${sig.actedAt}` : "Date: ____________", { align: "center", size: 9 }));
    r++;
  }

  // ---- Footer ----
  r++;
  setRange(ws, 1, TOTAL_COLS, r, "F-DC-006 Rev.12 Effective Date : 01/07/2022", {
    align: "right", italic: true, size: 8.5, border: false,
  });

  return wb;
}

export async function memoToExcelBuffer(
  memo: MemoRecord,
  signatures: MemoSignature[] = [],
): Promise<Buffer> {
  const wb = await buildMemoExcelWorkbook(memo, signatures);
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
