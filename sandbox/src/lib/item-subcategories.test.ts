import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_SUBCATEGORIES,
  getActiveItemSubcategories,
  getDefaultItemSubcategories,
  isApprovalCategory,
  resolveItemSubcategorySnapshot,
} from "./item-subcategories";

describe("item subcategories", () => {
  it("keeps Book1 Table 2 subcategories under their parent approval category", () => {
    expect(getDefaultItemSubcategories("fixed-asset").map(item => item.labelTh)).toEqual([
      "เครื่องจักร และ อุปกรณ์การผลิต",
      "เครื่องมือเครื่องใช้โรงงาน",
      "เครื่องมือเครื่องใช้สำนักงาน",
      "รถยนต์",
      "สินทรัพย์อื่น ๆ",
    ]);
    expect(getDefaultItemSubcategories("mold")).toEqual([]);
  });

  it("returns only active items sorted by parent category and sort order", () => {
    const rows = [
      { id: 5, categoryKey: "general-purchase", labelTh: "B", sortOrder: 20, isActive: true },
      { id: 6, categoryKey: "general-purchase", labelTh: "A", sortOrder: 10, isActive: true },
      { id: 7, categoryKey: "general-purchase", labelTh: "Hidden", sortOrder: 1, isActive: false },
    ] as const;

    expect(getActiveItemSubcategories(rows, "general-purchase").map(item => item.labelTh)).toEqual(["A", "B"]);
  });

  it("creates a memo snapshot from the selected subcategory id", () => {
    const target = DEFAULT_ITEM_SUBCATEGORIES.find(item => item.labelTh === "รถยนต์");

    expect(resolveItemSubcategorySnapshot(DEFAULT_ITEM_SUBCATEGORIES, target?.id ?? 0)).toEqual({
      itemSubcategoryId: target?.id,
      itemSubcategoryLabel: "รถยนต์",
    });
  });

  it("ignores inactive or missing selected subcategory ids", () => {
    const inactive = { id: 99, categoryKey: "fixed-asset", labelTh: "Hidden", sortOrder: 1, isActive: false } as const;

    expect(resolveItemSubcategorySnapshot([inactive], inactive.id)).toEqual({
      itemSubcategoryId: undefined,
      itemSubcategoryLabel: undefined,
    });
    expect(resolveItemSubcategorySnapshot([], 999)).toEqual({
      itemSubcategoryId: undefined,
      itemSubcategoryLabel: undefined,
    });
  });

  it("validates approval category keys for API inputs", () => {
    expect(isApprovalCategory("general-purchase")).toBe(true);
    expect(isApprovalCategory("unknown")).toBe(false);
    expect(isApprovalCategory(null)).toBe(false);
  });
});
