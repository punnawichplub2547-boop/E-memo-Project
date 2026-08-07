import { describe, expect, it } from "vitest";
import type { PriceComparison } from "./approval";
import { validateMemoFormForApproval } from "./validate-memo-form";

function makeRow(overrides: Partial<PriceComparison> = {}): PriceComparison {
  return {
    id: "row-1",
    vendorName: "ผู้ขาย ก",
    offeredPrice: 1000,
    discount: 0,
    vatEnabled: false,
    netPrice: 1000,
    remark: "",
    isSelected: true,
    ...overrides,
  };
}

const validBase = { subject: "ขออนุมัติซื้อของ", description: "รายละเอียด" };

describe("validateMemoFormForApproval — non-negotiable remark", () => {
  it("rejects when the selected vendor has no discount and no remark", () => {
    const result = validateMemoFormForApproval({ ...validBase, priceComparisons: [makeRow()] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("กรุณาระบุหมายเหตุของผู้ขายที่เลือก เนื่องจากไม่มีส่วนลด");
  });

  it("accepts when the remark is filled in", () => {
    const result = validateMemoFormForApproval({
      ...validBase,
      priceComparisons: [makeRow({ remark: "ไม่สามารถต่อรองราคาได้" })],
    });
    expect(result.valid).toBe(true);
  });

  it("treats a whitespace-only remark as missing", () => {
    const result = validateMemoFormForApproval({
      ...validBase,
      priceComparisons: [makeRow({ remark: "   " })],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts when the selected vendor gave a discount", () => {
    const result = validateMemoFormForApproval({
      ...validBase,
      priceComparisons: [makeRow({ discount: 100 })],
    });
    expect(result.valid).toBe(true);
  });

  it("ignores unselected rows with no discount and no remark", () => {
    const result = validateMemoFormForApproval({
      ...validBase,
      priceComparisons: [
        makeRow({ id: "row-1", remark: "ต่อรองแล้ว", discount: 50, isSelected: true }),
        makeRow({ id: "row-2", isSelected: false }),
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("ignores an empty price table", () => {
    const result = validateMemoFormForApproval({ ...validBase, priceComparisons: [] });
    expect(result.valid).toBe(true);
  });

  it("still reports the existing subject and description rules", () => {
    const result = validateMemoFormForApproval({ subject: "", description: "" });
    expect(result.errors).toContain("Please fill in the subject/title");
    expect(result.errors).toContain("Please fill in the description");
  });
});
