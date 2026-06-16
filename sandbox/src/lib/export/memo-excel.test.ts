import { describe, it, expect } from "vitest";
import { buildMemoExcelWorkbook, memoToExcelBuffer, type MemoSignature } from "./memo-excel";
import type { MemoRecord } from "../approval";

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

  it("memoToExcelBuffer returns a non-empty xlsx buffer", async () => {
    const buffer = await memoToExcelBuffer(makeMemo());
    expect(buffer.length).toBeGreaterThan(0);
    // .xlsx files are zip archives - PK magic header
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
