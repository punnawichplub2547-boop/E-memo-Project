// Builds an .xlsx replica of the paper "INTERNAL MEMO" form (F-DC-006) from a MemoRecord.
// Pure function: no DB/fs access except reading the static logo asset shipped in public/.
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ApprovalLevel, MemoRecord } from "../approval";
import { computePriceRowTotals } from "../approval";

export type MemoSignature = {
  stepLabel: ApprovalLevel;
  actorName: string;
  actedAt: string;
};

const THAI_FONT = "Tahoma";
const TOTAL_COLS = 12;

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

function findSignature(signatures: MemoSignature[], stepLabel: ApprovalLevel): MemoSignature | undefined {
  const matches = signatures.filter((s) => s.stepLabel === stepLabel);
  return matches[matches.length - 1];
}

export async function buildMemoExcelWorkbook(
  memo: MemoRecord,
  signatures: MemoSignature[] = [],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HR&GA E-Memo";
  wb.created = new Date();

  const ws = wb.addWorksheet("Memo", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });

  const colWidths = [6, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9];
  colWidths.forEach((w, i) => {
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
    ["To (ผู้บังคับบัญชา)", memo.currentStep],
    ["Subject", memo.title],
    ["Attachment", memo.attachments && memo.attachments.length > 0 ? `${memo.attachments.length} ไฟล์` : "-"],
  ];
  metaRows.forEach(([label, value], i) => {
    const row = gridStartRow + 1 + i;
    setRange(ws, 1, 3, row, `${label}: ${value}`, { size: 9, wrap: true });
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
  let r = gridStartRow + DEPT_GRID.length;
  setRange(ws, 1, TOTAL_COLS, r, "เรียน ผู้บังคับบัญชาตามสายงานอนุมัติ", { size: 10 }); r++;
  setRange(ws, 1, TOTAL_COLS, r, `เรื่อง: ${memo.title}`, { bold: true, size: 10.5 }); r++;
  ws.getRow(r).height = 32;
  setRange(ws, 1, TOTAL_COLS, r, `เนื่องจาก/เหตุผล: ${memo.description ?? "-"}`, { size: 10, wrap: true, valign: "top" }); r++;
  ws.getRow(r).height = 32;
  setRange(ws, 1, TOTAL_COLS, r, `ดังนั้น: ${memo.closingRemark ?? "-"}`, { size: 10, wrap: true, valign: "top" }); r++;

  // ---- Request items table ----
  setRange(ws, 1, 1, r, "ลำดับ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 2, 6, r, "รายการ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 7, 7, r, "หน่วย", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 8, 8, r, "จำนวน", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 9, 10, r, "ราคา/หน่วย", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 11, 12, r, "รวมเป็นเงิน", { bold: true, align: "center", fill: "FFF1F5F9" });
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

  // ---- Budget table ----
  r++;
  setRange(ws, 1, 1, r, "ลำดับ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 2, 4, r, "รายการ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 5, 6, r, "Budget Plan 2025", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 7, 8, r, "Budget ที่ใช้ไป", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 9, 10, r, "Budget ที่ขอใช้", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 11, 12, r, "Budget คงเหลือ", { bold: true, align: "center", fill: "FFF1F5F9" });
  r++;
  const budgetPlan = memo.budgetPlan;
  const budgetUsed = memo.budgetUsed ?? 0;
  const remaining = budgetPlan !== undefined ? budgetPlan - budgetUsed - memo.amount : undefined;
  setRange(ws, 1, 1, r, 1, { align: "center" });
  setRange(ws, 2, 4, r, memo.title, { wrap: true });
  setRange(ws, 5, 6, r, budgetPlan !== undefined ? money(budgetPlan) : "-", { align: "right" });
  setRange(ws, 7, 8, r, money(budgetUsed), { align: "right" });
  setRange(ws, 9, 10, r, money(memo.amount), { align: "right" });
  setRange(ws, 11, 12, r, remaining !== undefined ? money(remaining) : "-", { align: "right" });
  r++;

  // ---- Price comparison table ----
  r++;
  setRange(ws, 1, 1, r, "ลำดับ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 2, 5, r, "ผู้ให้บริการ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 6, 7, r, "ราคาเสนอ", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 8, 9, r, "ส่วนลด (ถ้ามี)", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 10, 11, r, "รวมราคาขาย/บริการทั้งสิ้น", { bold: true, align: "center", fill: "FFF1F5F9" });
  setRange(ws, 12, 12, r, "หมายเหตุ", { bold: true, align: "center", fill: "FFF1F5F9" });
  r++;
  const vendors = memo.priceComparisons ?? [];
  const vendorRowCount = Math.max(vendors.length, 3);
  for (let i = 0; i < vendorRowCount; i++) {
    const v = vendors[i];
    setRange(ws, 1, 1, r, i + 1, { align: "center" });
    if (v) {
      const { netPrice } = computePriceRowTotals(v);
      const selected = v.isSelected ? " (เลือกใช้บริการ)" : "";
      setRange(ws, 2, 5, r, `${v.vendorName}${selected}`, { bold: !!v.isSelected, wrap: true });
      setRange(ws, 6, 7, r, money(v.offeredPrice), { align: "right" });
      setRange(ws, 8, 9, r, money(v.discount), { align: "right" });
      setRange(ws, 10, 11, r, money(netPrice), { align: "right" });
      setRange(ws, 12, 12, r, v.remark ?? "", { wrap: true });
    } else {
      setRange(ws, 2, 5, r, "", {});
      setRange(ws, 6, 7, r, "", {});
      setRange(ws, 8, 9, r, "", {});
      setRange(ws, 10, 11, r, "", {});
      setRange(ws, 12, 12, r, "", {});
    }
    r++;
  }

  // ---- Closing line ----
  r++;
  setRange(ws, 1, TOTAL_COLS, r, "จึงเรียนมาเพื่อพิจารณาอนุมัติ", { align: "center", border: false }); r++;
  setRange(ws, 1, TOTAL_COLS, r, `ชื่อ-นามสกุล: ${memo.requester} (${memo.department})`, { align: "center", border: false }); r++;

  // ---- Signature block: Supervisor / Dept Manager / GM / Sr.GM / MD ----
  // The prototype's approval engine only models 3 levels (Manager / Top Section, General
  // Manager, Managing Director) — Supervisor and Sr.General Manager have no workflow
  // equivalent and are always left blank for a human wet-signature.
  r++;
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
  sigCols.forEach(([from, to, label]) => setRange(ws, from, to, r, label, { bold: true, align: "center", fill: "FFF1F5F9" }));
  r++;
  sigCols.forEach(([from, to, , sig]) => setRange(ws, from, to, r, sig ? `(${sig.actorName})` : "(...ชื่อ-สกุล...)", { align: "center" }));
  r++;
  sigCols.forEach(([from, to, , sig]) => setRange(ws, from, to, r, sig ? `Date: ${sig.actedAt}` : "Date: ____________", { align: "center", size: 9 }));
  r++;

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
