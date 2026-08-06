// The queue's export always feeds memoToExcelBuffer a memo that has been through
// the workflow. The /create preview feeds it one that has not: no memo number, no
// signatures, and collections that may still be empty because the user is only
// part-way through the form. These lock in that the generator tolerates that.
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { memoToExcelBuffer } from "./memo-excel";
import { buildMemoDraftRecord, type MemoDraftFields } from "../build-memo-draft-record";

function draftFields(overrides: Partial<MemoDraftFields> = {}): MemoDraftFields {
  return {
    subject: "",
    category: "general-purchase",
    department: "IT",
    amount: 0,
    description: "",
    closingRemark: "",
    budgetStatus: "in-budget",
    accountCode: "",
    budgetPlan: 0,
    budgetUsed: 0,
    requestItems: [],
    priceComparisons: [],
    selectedVendor: undefined,
    selectedNotLowest: false,
    cleanVendorReason: "",
    effectiveIsPriceAdjustment: false,
    priceAdjustmentReason: "",
    effectiveFollowsProductionPlan: false,
    effectiveIsDeadStock: false,
    showDeptMonthly: false,
    deptMonthlyOverBudgetTotal: 0,
    orderedReadRecipients: [],
    recommendation: {
      recommendedFinalApprover: "General Manager",
      notifyMD: false,
      requiresMdReview: false,
    },
    routeReview: { recommendedRoute: [], mode: "recommended", requiresReason: false },
    selectedRoute: [],
    cleanOverrideReason: "",
    firstCheckingStep: "Manager / Top Section",
    ...overrides,
  };
}

const asDraft = (fields: MemoDraftFields) =>
  buildMemoDraftRecord(fields, {
    id: "",
    requester: "ผู้ดูแลระบบ E-Memo",
    status: "draft",
    timestamp: "06 Aug 2026 10:11",
  });

function stringCells(ws: ExcelJS.Worksheet): string[] {
  const texts: string[] = [];
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === "string") texts.push(cell.value);
    });
  });
  return texts;
}

async function openWorkbook(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Memo");
  expect(ws).toBeTruthy();
  return ws!;
}

describe("Excel form from an unsaved draft", () => {
  it("builds a readable workbook from a completely empty form", async () => {
    const ws = await openWorkbook(await memoToExcelBuffer(asDraft(draftFields()), []));
    expect(ws.rowCount).toBeGreaterThan(0);
  });

  it("leaves Ref.No blank rather than inventing a memo number", async () => {
    const ws = await openWorkbook(await memoToExcelBuffer(asDraft(draftFields()), []));
    // The sheet writes label and value into one merged string ("Ref.No: <id>"),
    // so the id is whatever follows the colon.
    const ref = stringCells(ws).find((t) => t.startsWith("Ref.No:"));
    expect(ref).toBeDefined();
    expect(ref!.slice("Ref.No:".length).trim()).toBe("");
  });

  it("still prints Ref.No when the memo does have a number (revision preview)", async () => {
    const revision = buildMemoDraftRecord(draftFields(), {
      id: "EM-2026-002",
      requester: "ผู้ดูแลระบบ E-Memo",
      status: "returned",
      timestamp: "06 Aug 2026 10:11",
    });
    const ws = await openWorkbook(await memoToExcelBuffer(revision, []));
    const ref = stringCells(ws).find((t) => t.startsWith("Ref.No:"));
    expect(ref!.slice("Ref.No:".length).trim()).toBe("EM-2026-002");
  });

  it("keeps Thai content intact through a filled draft", async () => {
    const record = asDraft(
      draftFields({
        subject: "ขออนุมัติจัดซื้ออุปกรณ์สำนักงาน",
        amount: 1500,
        description: "ใช้ในงานประจำเดือน",
        requestItems: [{ id: "r1", name: "กระดาษ A4", qty: 2, unit: "รีม", unitPrice: 750 }],
        selectedRoute: ["Manager / Top Section", "General Manager"],
      }),
    );
    const ws = await openWorkbook(await memoToExcelBuffer(record, []));

    const texts = stringCells(ws);
    expect(texts.some((t) => t.includes("ขออนุมัติจัดซื้ออุปกรณ์สำนักงาน"))).toBe(true);
    expect(texts.some((t) => t.includes("กระดาษ A4"))).toBe(true);
  });
});
