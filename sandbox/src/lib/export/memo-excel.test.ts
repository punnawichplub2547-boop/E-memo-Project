import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildMemoExcelWorkbook, memoToExcelBuffer, type MemoSignature } from "./memo-excel";
import type { MemoRecord } from "../approval";

async function reasonRowHeight(description: string): Promise<number> {
  const wb = await buildMemoExcelWorkbook(makeMemo({ description }));
  const ws = wb.getWorksheet("Memo")!;
  let h = 0;
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === "string" && cell.value.startsWith("เนื่องจาก/เหตุผล")) {
        h = Number(row.height ?? 0);
      }
    });
  });
  return h;
}

function makeMemo(overrides: Partial<MemoRecord> = {}): MemoRecord {
  return {
    id: "EM-2026-099",
    title: "ขออนุมัติซื้อวัตถุดิบ",
    requester: "สมชาย ใจดี",
    department: "HR&GA",
    category: "general-purchase",
    amount: 15000,
    status: "pending",
    currentStep: "General Manager",
    cycleHours: 0,
    createdAt: "01 Jan 2026 09:00",
    updatedAt: "01 Jan 2026 09:00",
    ...overrides,
  };
}

describe("buildMemoExcelWorkbook", () => {
  it("creates a worksheet named Memo", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo());
    expect(wb.getWorksheet("Memo")).toBeTruthy();
  });

  it("ticks the checkbox matching memo.department and leaves others unchecked", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ department: "IT" }));
    const ws = wb.getWorksheet("Memo")!;
    let foundChecked = "";
    for (let row = 1; row <= 20; row++) {
      for (let col = 1; col <= 12; col++) {
        const value = ws.getCell(row, col).value;
        if (typeof value === "string" && value.startsWith("☑")) {
          foundChecked = value;
        }
      }
    }
    expect(foundChecked).toBe("☑ IT");
  });

  it("renders main category and item subcategory in the memo metadata", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ itemSubcategoryLabel: "office supplies" }));
    const ws = wb.getWorksheet("Memo")!;
    let text = "";
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") text += cell.value + "\n";
      });
    });
    expect(text).toContain("Category:");
    expect(text).toContain("Subcategory: office supplies");
  });

  it("sums request item totals into the subtotal row", async () => {
    const memo = makeMemo({
      requestItems: [
        { id: "1", name: "กระดาษ A4", unit: "กล่อง", qty: 2, unitPrice: 500 },
        { id: "2", name: "หมึกพิมพ์", unit: "ขวด", qty: 3, unitPrice: 1000 },
      ],
    });
    const wb = await buildMemoExcelWorkbook(memo);
    const ws = wb.getWorksheet("Memo")!;
    const values: number[] = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "number") values.push(cell.value);
      });
    });
    // 2*500 + 3*1000 = 4000, appears as a row total and again as the subtotal/grand total
    expect(values.filter((v) => v === 4000).length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to memo.amount as the subtotal when there are no request items", async () => {
    const memo = makeMemo({ amount: 7777, requestItems: [] });
    const wb = await buildMemoExcelWorkbook(memo);
    const ws = wb.getWorksheet("Memo")!;
    const values: number[] = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "number") values.push(cell.value);
      });
    });
    expect(values).toContain(7777);
  });

  it("places approver names/dates from signatures into the matching column and leaves Supervisor/Sr.GM blank", async () => {
    const signatures: MemoSignature[] = [
      { stepLabel: "General Manager", actorName: "วิชัย โรจน์ดี", actedAt: "02 Jan 2026 10:00" },
    ];
    const wb = await buildMemoExcelWorkbook(makeMemo(), signatures);
    const ws = wb.getWorksheet("Memo")!;
    let text = "";
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") text += cell.value + "\n";
      });
    });
    expect(text).toContain("วิชัย โรจน์ดี");
    expect(text).toContain("(...ชื่อ-สกุล...)"); // Supervisor / Sr.GM placeholder still present
  });

  it("renders closingRemark as a หมายเหตุ note in the closing block", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ closingRemark: "ขออนุมัติเบิกเป็นเงินสด" }));
    const ws = wb.getWorksheet("Memo")!;
    let text = "";
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") text += cell.value + "\n";
      });
    });
    expect(text).toContain("หมายเหตุ: ขออนุมัติเบิกเป็นเงินสด");
    expect(text).toContain("ขอแสดงความนับถือ");
  });

  it("grows the budget row height so a long title does not clip", async () => {
    const longTitle =
      "ขออนุมัติจัดซื้อสินทรัพย์ถาวร เครื่องคอมพิวเตอร์และอุปกรณ์ต่อพ่วงสำหรับแผนกไอที วงเงินรวม 70,000 บาท";
    const wb = await buildMemoExcelWorkbook(makeMemo({ title: longTitle }));
    const ws = wb.getWorksheet("Memo")!;
    // The budget row holds the title merged across cols 2-4 (narrow) — it must wrap to
    // multiple lines, so at least one row should be taller than a single default line.
    let maxHeight = 0;
    ws.eachRow((row) => {
      if (typeof row.height === "number") maxHeight = Math.max(maxHeight, row.height);
    });
    expect(maxHeight).toBeGreaterThan(30);
  });

  it("memoToExcelBuffer returns a non-empty xlsx buffer", async () => {
    const buffer = await memoToExcelBuffer(makeMemo());
    expect(buffer.length).toBeGreaterThan(0);
    // .xlsx files are zip archives - PK magic header
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});

describe("Thai layout fit", () => {
  // Regression: ExcelJS 4.4.0 treats width exactly 9 as its internal default and drops
  // it from the file, so columns set to 9 fall back to Excel's default and Thai text
  // overflows. All 12 columns must keep an explicit width after a save/load round-trip.
  it("persists all 12 column widths through a save → load round-trip", async () => {
    const buf = await memoToExcelBuffer(makeMemo());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("Memo")!;
    for (let c = 1; c <= 12; c++) {
      expect(ws.getColumn(c).width ?? 0).toBeGreaterThan(0);
    }
  });

  it("grows the reason row tall enough for a long Thai description (no clipping)", async () => {
    // ~360 Thai chars across the full-width merged cell. Thai glyphs pack fewer per
    // column-width unit than Latin digits, so the height estimate must be generous —
    // the old 0.8 density / 15px line gave ~75px (clips); the Thai-aware estimate ≥100px.
    const longThai =
      "ขออนุมัติจัดซื้อวัตถุดิบยางธรรมชาติเกรดพิเศษจำนวนมากเพื่อใช้ในการผลิตตามแผนการผลิตประจำเดือน".repeat(4);
    expect(await reasonRowHeight(longThai)).toBeGreaterThanOrEqual(100);
  });

  it("scales the reason row height with description length", async () => {
    const short = await reasonRowHeight("สั้น");
    const long = await reasonRowHeight("ยาว".repeat(120));
    expect(long).toBeGreaterThan(short);
  });

  // Regression: long Thai table headers (e.g. the price-comparison "รวมราคาขาย/บริการ
  // ทั้งสิ้น", merged across only ~19 width units) used to render with wrapText off, so the
  // text spilled past the cell's right border into the neighbouring "หมายเหตุ" column.
  // gridlines are hidden, so the only visible frame is the cell border — overflowing it is
  // exactly the "ฟอนต์เลยกรอบ" the form looked broken with.
  function cellByValue(ws: ExcelJS.Worksheet, value: string): { cell: ExcelJS.Cell; rowHeight: number } | null {
    let found: { cell: ExcelJS.Cell; rowHeight: number } | null = null;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === value) found = { cell, rowHeight: Number(row.height ?? 0) };
      });
    });
    return found;
  }

  const longThaiHeaders = ["รวมราคาขาย/บริการทั้งสิ้น", "Budget ที่ใช้ไป", "Budget คงเหลือ", "Sr.General Manager"];

  it.each(longThaiHeaders)("wraps the table header %s so it stays inside its border", async (header) => {
    const wb = await buildMemoExcelWorkbook(makeMemo());
    const ws = wb.getWorksheet("Memo")!;
    const hit = cellByValue(ws, header);
    expect(hit, `header "${header}" not found`).not.toBeNull();
    expect(hit!.cell.alignment?.wrapText).toBe(true);
  });

  it("grows the price-comparison header row so the wrapped Thai header does not clip", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo());
    const ws = wb.getWorksheet("Memo")!;
    const hit = cellByValue(ws, "รวมราคาขาย/บริการทั้งสิ้น");
    expect(hit).not.toBeNull();
    // 24 Thai chars across ~19 width units wraps to 2 lines — the row must be > one line tall.
    expect(hit!.rowHeight).toBeGreaterThan(16);
  });

  it("wraps a long subject line so it stays on the page", async () => {
    const longSubject =
      "ขออนุมัติจัดซื้อวัตถุดิบยางธรรมชาติเกรดพิเศษจำนวนมากเพื่อใช้ในการผลิตตามแผนการผลิตประจำเดือนกรกฎาคม";
    const wb = await buildMemoExcelWorkbook(makeMemo({ title: longSubject }));
    const ws = wb.getWorksheet("Memo")!;
    const hit = cellByValue(ws, `เรื่อง: ${longSubject}`);
    expect(hit, "subject row not found").not.toBeNull();
    expect(hit!.cell.alignment?.wrapText).toBe(true);
    expect(hit!.rowHeight).toBeGreaterThan(16);
  });
});
