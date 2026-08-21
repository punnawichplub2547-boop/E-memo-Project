import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildMemoExcelWorkbook, memoToExcelBuffer, type MemoSignature } from "./memo-excel";
import type { MemoRecord } from "../approval";
import { buildCustomRoute } from "../custom-route";

// C3 (carry-in): this file used to have 3 near-duplicate `sheetText()`-style helpers (plus
// several more test bodies that inlined the identical accumulation pattern by hand) — one of
// them (the "custom per-person signature block" describe block) did NOT skip
// `ExcelJS.ValueType.Merge` cells. Every `setRange()` call in this file merges a column span,
// and `row.eachCell()` visits every cell inside a merge, not just the master — so an
// unfiltered accumulator reports the same printed string once per column the merge spans. That
// was harmless everywhere it was actually used (all callers only ever called `.toContain()` /
// `.not.toContain()`, never counted occurrences), but it is exactly the bug this project has
// already shipped once (a merge-width-inflated occurrence count) — consolidated here to the
// one implementation every test in the file now shares, so there is only one place left that
// could regress.
function sheetText(ws: ExcelJS.Worksheet): string {
  const parts: string[] = [];
  ws.eachRow((row) => row.eachCell((cell) => {
    if (cell.type === ExcelJS.ValueType.Merge) return;
    parts.push(String(cell.value ?? ""));
  }));
  return parts.join("\n");
}

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
    const text = sheetText(wb.getWorksheet("Memo")!);
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
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).toContain("วิชัย โรจน์ดี");
    expect(text).toContain("(...ชื่อ-สกุล...)"); // Supervisor / Sr.GM placeholder still present
  });

  it("renders closingRemark as a หมายเหตุ note in the closing block", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ closingRemark: "ขออนุมัติเบิกเป็นเงินสด" }));
    const text = sheetText(wb.getWorksheet("Memo")!);
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

describe("buildMemoExcelWorkbook — custom per-person signature block", () => {
  // C3: this block's local sheetText() used to NOT filter ExcelJS.ValueType.Merge cells — see
  // the top-level sheetText() doc comment. Every test below only ever used .toContain()/
  // .not.toContain(), never counted occurrences, so switching to the merge-aware shared helper
  // changes nothing about what these tests verify (confirmed by running them — see
  // task-12-report.md).
  const manyApprovers = buildCustomRoute(
    Array.from({ length: 8 }, (_, i) => ({
      userId: i + 1,
      name: `ผู้อนุมัติ ${i + 1}`,
      approvalLevel: "Manager / Top Section",
      department: "IT",
    })),
  ).approvers;

  it("prints custom approver names in the signature block and a hidden-count note", async () => {
    const wb = await buildMemoExcelWorkbook(
      makeMemo({
        currentStep: manyApprovers[0].stepKey,
        selectedRoute: manyApprovers.map((a) => a.stepKey),
        customRoute: manyApprovers,
      }),
      [],
    );
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).toContain("ผู้อนุมัติ 1");
    expect(text).toContain("ผู้อนุมัติ 8");
    expect(text).not.toContain("ผู้อนุมัติ 6");
    expect(text).toContain("มีผู้อนุมัติเพิ่มอีก 3 คน");
  });

  it("names the current approver on the To line instead of a raw token", async () => {
    const wb = await buildMemoExcelWorkbook(
      makeMemo({
        currentStep: manyApprovers[1].stepKey,
        selectedRoute: manyApprovers.map((a) => a.stepKey),
        customRoute: manyApprovers,
      }),
      [],
    );
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).not.toContain("person:2#2");
    expect(text).toContain("ผู้อนุมัติ 2");
  });

  it("omits the hidden-count note when every approver fits", async () => {
    const three = buildCustomRoute(
      Array.from({ length: 3 }, (_, i) => ({
        userId: i + 1,
        name: `ผู้อนุมัติ ${i + 1}`,
        approvalLevel: "Manager / Top Section",
        department: "IT",
      })),
    ).approvers;
    const wb = await buildMemoExcelWorkbook(
      makeMemo({
        currentStep: three[0].stepKey,
        selectedRoute: three.map((a) => a.stepKey),
        customRoute: three,
      }),
      [],
    );
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).not.toContain("มีผู้อนุมัติเพิ่มอีก");
    expect(text).toContain("ผู้อนุมัติ 3");
  });

  it("keeps the classic 5 fixed labels for a level-route memo", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ currentStep: "General Manager" }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).toContain("Sr.General Manager");
    expect(text).toContain("Department Manager");
    expect(text).toContain("Supervisor");
    expect(text).not.toContain("มีผู้อนุมัติเพิ่มอีก");
  });
});

describe("buildMemoExcelWorkbook — free-form body blocks (Task 11)", () => {
  // C3: uses the top-level sheetText() (merge-aware — see its doc comment). Every setRange()
  // call here merges a column span, and ExcelJS's row.eachCell() visits every cell in a merge,
  // not just the master — the non-master cells mirror the master's .value. Counting occurrences
  // without filtering those out double/quadruple-counts a single printed value (a 4-wide merge
  // reports the same string 4 times), which would make the "printed twice" tests below fail
  // even when the sheet only has ONE real table.

  it("prints the blocks in the order the requester arranged them", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [
        { id: "1", type: "paragraph", text: "ย่อหน้าแรก" },
        { id: "2", type: "table", headers: ["ผู้ขาย", "ราคา"], rows: [["ก", "100"]] },
        { id: "3", type: "keyValue", pairs: [{ key: "Project", value: "ทดสอบ" }] },
      ],
    }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).toContain("ย่อหน้าแรก");
    expect(text).toContain("ผู้ขาย");
    expect(text).toContain("Project");
    expect(text.indexOf("ย่อหน้าแรก")).toBeLessThan(text.indexOf("ผู้ขาย"));
    expect(text.indexOf("ผู้ขาย")).toBeLessThan(text.indexOf("Project"));
  });

  // Real PriceComparison shape (id/vendorName/offeredPrice/discount/netPrice/isSelected) —
  // the brief's sample cast a `{vendor, price}` shape with `as never`, which is exactly the
  // "cast instead of validate" pattern C2 warns about; using the real fields here means
  // TypeScript would actually catch a shape drift instead of silently passing through a cast.
  it("does not print the price table twice on a free-form memo", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "s", type: "system", ref: "priceComparison" }],
      priceComparisons: [
        { id: "v1", vendorName: "ผู้ขายเดียว", offeredPrice: 100, discount: 0, netPrice: 100, isSelected: false },
      ],
    }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text.split("ผู้ขายเดียว").length - 1).toBe(1);
  });

  it("does not print the request items table twice on a free-form memo", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "s", type: "system", ref: "requestItems" }],
      requestItems: [{ id: "i1", name: "ของชิ้นเดียว", unit: "ชิ้น", qty: 1, unitPrice: 100 }],
    }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text.split("ของชิ้นเดียว").length - 1).toBe(1);
  });

  it("splits a very long paragraph so no row exceeds Excel's height limit", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "1", type: "paragraph", text: "ก".repeat(5000) }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    ws.eachRow((row) => expect(row.height ?? 0).toBeLessThanOrEqual(409));
  });

  // C3#1: Thai text has no inter-word spaces, so chunkText's `lastIndexOf(" ", size)` always
  // returns -1 for pure-Thai input and every cut lands exactly at `size`. This proves that
  // behaviour directly (chunk lengths, not just "no row is too tall") instead of trusting the
  // brief's claim that it is acceptable.
  it("cuts pure Thai text (no spaces) at exactly the 1200-char boundary, not before", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "1", type: "paragraph", text: "ก".repeat(5000) }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    const chunks: string[] = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        // Paragraph rows merge cols 1-12 into one cell; eachCell visits every mirrored
        // cell in the merge (same artifact as the sheetText() helper above), so skip
        // non-master merge cells or each chunk gets counted 12 times.
        if (cell.type === ExcelJS.ValueType.Merge) return;
        if (typeof cell.value === "string" && /^ก+$/.test(cell.value)) chunks.push(cell.value);
      });
    });
    expect(chunks.map((c) => c.length)).toEqual([1200, 1200, 1200, 1200, 200]);
  });

  // I2: the .xlsx format encodes cell type explicitly — ExcelJS decides it in
  // doc/cell.js::getType(), where a plain string is always Cell.Types.String and
  // Cell.Types.Formula requires an object value with a `formula`/`sharedFormula` key
  // (there is no `startsWith('=')` anywhere in exceljs/lib). So nothing the requester
  // types can become a formula in a file this generator writes, and the apostrophe
  // prefix that used to be added here bought zero protection while corrupting real
  // Thai text — a body line starting with "- " is completely ordinary and was being
  // printed as "'- ..." on the ISO form.
  //
  // These tests therefore assert BOTH halves: the text survives verbatim AND the cell
  // is still a plain string. Checking only the text would keep passing if someone
  // later wrote the value as a real formula object.
  function findCellByValue(ws: ExcelJS.Worksheet, value: string): ExcelJS.Cell | undefined {
    const matches: ExcelJS.Cell[] = [];
    ws.eachRow((row) => row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Merge) return;
      if (cell.value === value) matches.push(cell);
    }));
    return matches[0];
  }

  function expectPlainString(ws: ExcelJS.Worksheet, value: string) {
    const cell = findCellByValue(ws, value);
    expect(cell, `no cell holds ${JSON.stringify(value)} verbatim`).toBeDefined();
    expect(cell!.type).toBe(ExcelJS.ValueType.String);
    expect(cell!.formula).toBeUndefined();
  }

  it("writes formula-looking text in a table cell verbatim, as a string not a formula", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "t", type: "table", headers: ["ช่อง"], rows: [['=HYPERLINK("http://evil")']] }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    expectPlainString(ws, '=HYPERLINK("http://evil")');
    expect(sheetText(ws)).not.toContain(`'=HYPERLINK`);
  });

  it("writes formula-looking text in a key-value pair verbatim, as a string not a formula", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "kv", type: "keyValue", pairs: [{ key: "=cmd", value: "+2+3" }] }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    expectPlainString(ws, "=cmd");
    expectPlainString(ws, "+2+3");
  });

  // Coverage minor #3: the old suite only covered a body cell and a key-value pair.
  it("writes formula-looking text in a table HEADER verbatim, as a string not a formula", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "t", type: "table", headers: ["@SUM(A1:A9)"], rows: [["ค่า"]] }],
    }), []);
    expectPlainString(wb.getWorksheet("Memo")!, "@SUM(A1:A9)");
  });

  it("writes a paragraph that starts with a hyphen verbatim, as a string not a formula", async () => {
    // The real-world regression: "-" is a FORMULA_TRIGGERS character, and a Thai memo
    // bullet line beginning with "- " is completely ordinary.
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "p", type: "paragraph", text: "- ค่าขนส่ง 2,000 บาท" }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    expectPlainString(ws, "- ค่าขนส่ง 2,000 บาท");
    expect(sheetText(ws)).not.toContain("'- ค่าขนส่ง");
  });

  it("writes a paragraph that starts with = verbatim, as a string not a formula", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "p", type: "paragraph", text: "=cmd|'/c calc'!A1" }],
    }), []);
    expectPlainString(wb.getWorksheet("Memo")!, "=cmd|'/c calc'!A1");
  });

  it("still renders the budget table on a free-form memo (fixed position, not a block)", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "1", type: "paragraph", text: "เนื้อหาอิสระ" }],
      budgetPlan: 50000,
      budgetUsed: 10000,
    }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).toContain("Budget Plan 2025");
  });

  it("keeps a standard memo's layout unchanged", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ formMode: "standard" }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    expect(text).toContain("เนื่องจาก/เหตุผล");
  });
});

describe("buildMemoExcelWorkbook — fix round 1 (H1/H2)", () => {
  // C3: uses the top-level sheetText() (merge-aware — see its doc comment).

  // H1: spanColumns() clamps at MAX_TABLE_COLUMNS (8). The live write path
  // (memo-body-blocks-server.ts) already rejects >8 headers before persist, but the export
  // layer must not crash if that upstream guarantee is ever bypassed (legacy row, seed
  // fixture, future validator refactor) — it must degrade, not 500 the whole export.
  it("does not throw when a table block has more headers than spanColumns can address", async () => {
    const headers = Array.from({ length: 10 }, (_, i) => `col${i + 1}`);
    const rows = [Array.from({ length: 10 }, (_, i) => `v${i + 1}`)];
    await expect(
      buildMemoExcelWorkbook(makeMemo({
        formMode: "freeform",
        bodyBlocks: [{ id: "t", type: "table", headers, rows }],
      }), [])
    ).resolves.toBeTruthy();
  });

  it("folds overflow headers/cells into the last column instead of dropping them", async () => {
    const headers = Array.from({ length: 10 }, (_, i) => `col${i + 1}`);
    const rows = [Array.from({ length: 10 }, (_, i) => `v${i + 1}`)];
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "t", type: "table", headers, rows }],
    }), []);
    const text = sheetText(wb.getWorksheet("Memo")!);
    // Every header and every value must still be visible somewhere — the overflow (cols
    // 8-10, beyond spanColumns' 8-column clamp) is folded into the 8th cell, not dropped.
    for (let i = 1; i <= 10; i++) {
      expect(text).toContain(`col${i}`);
      expect(text).toContain(`v${i}`);
    }
  });

  // Same defense on a row alone (headers within bounds, one row longer than the header row —
  // data can drift from headers independently of the headers.length check).
  it("does not throw when a single row has more cells than the table's spans", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{
        id: "t",
        type: "table",
        headers: ["A", "B"],
        rows: [Array.from({ length: 9 }, (_, i) => `r${i + 1}`)],
      }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    expect(ws).toBeTruthy();
  });

  // H2: the 409pt ceiling must hold for every fitRowHeight caller, not just paragraph
  // chunks — table cells and key-value values have no length gate anywhere in the pipeline
  // (memo-body-blocks-server.ts only checks shape/column-count, never string length).
  it("caps a very long table cell so its row never exceeds Excel's 409pt ceiling", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "t", type: "table", headers: ["A", "B"], rows: [["ก".repeat(5000), "x"]] }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    ws.eachRow((row) => expect(row.height ?? 0).toBeLessThanOrEqual(409));
  });

  it("caps a very long key-value value so its row never exceeds Excel's 409pt ceiling", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "kv", type: "keyValue", pairs: [{ key: "K", value: "ก".repeat(5000) }] }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    ws.eachRow((row) => expect(row.height ?? 0).toBeLessThanOrEqual(409));
  });

  it("does not truncate the cell text when the row height is capped", async () => {
    const longText = "ก".repeat(5000);
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "t", type: "table", headers: ["A"], rows: [[longText]] }],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    let found = "";
    ws.eachRow((row) => row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Merge) return;
      if (typeof cell.value === "string" && cell.value.length === 5000) found = cell.value;
    }));
    expect(found).toBe(longText);
  });
});

describe("buildMemoExcelWorkbook — Task 12: multi-page print setup", () => {
  it("repeats the ISO header on every printed page", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ formMode: "standard" }), []);
    const ws = wb.getWorksheet("Memo")!;
    expect(ws.pageSetup.printTitlesRow).toBe("1:3");
  });

  it("numbers the pages in the footer", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ formMode: "standard" }), []);
    const ws = wb.getWorksheet("Memo")!;
    expect(ws.headerFooter?.oddFooter).toContain("&P");
    expect(ws.headerFooter?.oddFooter).toContain("&N");
  });

  // C2: we cannot know from an unrendered workbook where Excel will actually paginate — only
  // Excel's own renderer decides that. What we control (and can test) is our OWN decision to
  // insert a manual break via Row.addPageBreak() before the signature block; ws.model.rowBreaks
  // reflects exactly the breaks our code asked for, nothing about real pagination. These two
  // tests assert that decision, not a page count or a page position.
  it("does not add a manual page break before the signature block on a short memo", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({ formMode: "standard" }), []);
    const ws = wb.getWorksheet("Memo")!;
    expect(ws.model.rowBreaks).toHaveLength(0);
  });

  // C1: sized empirically (not guessed) against this file's real fitRowHeight/page-height
  // constants via a throwaway probe script — see task-12-report.md for the exact numbers and
  // how they were obtained — rather than assumed from the brief's flat "44 rows/page" model,
  // which Task 11 already made wrong for exactly this kind of content (see the block comment
  // above PAGE_PRINTABLE_HEIGHT_POINTS in memo-excel.ts).
  it("adds a manual page break before the signature block once a long free-form body nearly fills a page", async () => {
    const wb = await buildMemoExcelWorkbook(makeMemo({
      formMode: "freeform",
      bodyBlocks: [
        { id: "1", type: "paragraph", text: "ก".repeat(5000) },
        { id: "2", type: "paragraph", text: "ก".repeat(1300) },
      ],
    }), []);
    const ws = wb.getWorksheet("Memo")!;
    expect(ws.model.rowBreaks.length).toBeGreaterThanOrEqual(1);
  });
});
