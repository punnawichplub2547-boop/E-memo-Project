import { describe, it, expect } from "vitest";
import { csvCell, memoToCsvRow, memosToCsv, MEMO_CSV_HEADERS } from "./memo-csv";
import type { MemoRecord } from "../approval";

// Minimal MemoRecord factory — only the fields the CSV reads matter.
function memo(over: Partial<MemoRecord>): MemoRecord {
  return {
    id: "EM-2026-001",
    title: "ซื้อหมึกพิมพ์",
    requester: "สมชาย ขายความจริง",
    department: "IT",
    category: "general-purchase",
    amount: 1000,
    status: "approved",
    currentStep: "Manager / Top Section",
    selectedRoute: ["Manager / Top Section"],
    cycleHours: 5,
    createdAt: "01 Jun 2026 09:00",
    updatedAt: "02 Jun 2026 10:00",
    ...over,
  } as MemoRecord;
}

describe("csvCell", () => {
  it("leaves plain values untouched", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(1000)).toBe("1000");
  });

  it("renders null/undefined as empty string", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes fields containing a comma", () => {
    expect(csvCell("a, b")).toBe('"a, b"');
  });

  it("quotes and doubles internal double-quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("memosToCsv", () => {
  it("starts with the header row", () => {
    const csv = memosToCsv([]);
    expect(csv).toBe(MEMO_CSV_HEADERS.join(","));
  });

  it("uses CRLF line endings between rows", () => {
    const csv = memosToCsv([memo({})]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2); // header + 1 data row
  });

  it("translates status and category to Thai labels", () => {
    const row = memoToCsvRow(memo({ status: "rejected", category: "general-purchase" }));
    expect(row).toContain("ปฏิเสธ");
    // category label comes from approvalLabels, not the raw key
    expect(row).not.toContain("general-purchase");
  });

  it("includes the item subcategory after the main category", () => {
    const row = memoToCsvRow(memo({ itemSubcategoryLabel: "office supplies" }));
    const cells = row.split(",");
    expect(MEMO_CSV_HEADERS).toContain("หมวดรายการย่อย");
    expect(cells[5]).toBe("office supplies");
  });

  it("joins the approval route with arrows", () => {
    const row = memoToCsvRow(
      memo({ selectedRoute: ["Manager / Top Section", "General Manager", "Managing Director"] }),
    );
    expect(row).toContain("Manager / Top Section -> General Manager -> Managing Director");
  });

  it("falls back to currentStep when there is no route", () => {
    const row = memoToCsvRow(memo({ selectedRoute: undefined, currentStep: "General Manager" }));
    // route column should still show the current step
    expect(row).toContain("General Manager");
  });

  it("formats reject reason with its disposition", () => {
    const row = memoToCsvRow(
      memo({ status: "rejected", rejectReason: "งบเกิน", rejectDisposition: "revision-allowed" }),
    );
    expect(row).toContain("อนุญาตให้แก้ไข: งบเกิน");
  });

  it("escapes a comma inside the title without breaking columns", () => {
    const row = memoToCsvRow(memo({ title: "ซื้อหมึก, กระดาษ" }));
    expect(row).toContain('"ซื้อหมึก, กระดาษ"');
  });

  it("emits one data row per memo", () => {
    const csv = memosToCsv([memo({ id: "EM-1" }), memo({ id: "EM-2" })]);
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2
  });
});
