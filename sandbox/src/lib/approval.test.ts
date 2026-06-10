import { describe, expect, it } from "vitest";
import {
  analyzeApprovalRoute,
  buildApprovalFlow,
  getApprovalLevel,
  getApprovalRecommendation,
  getDashboardMetrics,
  seedMemos
} from "./approval";

describe("approval rules from HR&GA workbook (Book1.xlsx)", () => {
  it("routes budgeted general purchases up to 10,000 baht to manager approval", () => {
    expect(
      getApprovalLevel({
        category: "general-purchase",
        amount: 9000,
        budgetStatus: "in-budget"
      })
    ).toBe("Manager / Top Section");
  });

  it("routes budgeted general purchases above 50,000 baht to MD approval", () => {
    expect(
      getApprovalLevel({
        category: "general-purchase",
        amount: 75000,
        budgetStatus: "in-budget"
      })
    ).toBe("Managing Director");
  });

  it("routes mold requests to MD approval every time", () => {
    expect(
      getApprovalLevel({
        category: "mold",
        amount: 1,
        budgetStatus: "in-budget"
      })
    ).toBe("Managing Director");
  });

  it("does NOT allow Manager-tier approval for raw-material even under 10k (Book1 row 1.2)", () => {
    const rec = getApprovalRecommendation({
      category: "raw-material",
      amount: 5000,
      budgetStatus: "in-budget"
    });
    expect(rec.recommendedFinalApprover).toBe("General Manager");
    expect(rec.reason).toContain("1.2");
  });

  it("routes raw-material followsProductionPlan to GM regardless of amount (Book1 row 1.1)", () => {
    const rec = getApprovalRecommendation({
      category: "raw-material",
      amount: 250000,
      budgetStatus: "in-budget",
      followsProductionPlan: true
    });
    expect(rec.recommendedFinalApprover).toBe("General Manager");
    expect(rec.reason).toContain("1.1");
  });

  it("marks notifyMD true when supplier price adjustment is set on raw-material or fixed-asset", () => {
    const raw = getApprovalRecommendation({
      category: "raw-material",
      amount: 9000,
      budgetStatus: "in-budget",
      isPriceAdjustment: true
    });
    expect(raw.notifyMD).toBe(true);
    expect(raw.recommendedFinalApprover).toBe("General Manager");

    const fixed = getApprovalRecommendation({
      category: "fixed-asset",
      amount: 50000,
      budgetStatus: "in-budget",
      isPriceAdjustment: true
    });
    expect(fixed.notifyMD).toBe(true);
    expect(fixed.recommendedFinalApprover).toBe("General Manager");
  });

  it("ignores price-adjustment flag for service-contract and general-purchase", () => {
    const svc = getApprovalRecommendation({
      category: "service-contract",
      amount: 5000,
      budgetStatus: "in-budget",
      isPriceAdjustment: true
    });
    expect(svc.notifyMD).toBe(false);

    const gp = getApprovalRecommendation({
      category: "general-purchase",
      amount: 5000,
      budgetStatus: "in-budget",
      isPriceAdjustment: true
    });
    expect(gp.notifyMD).toBe(false);
  });

  it("escalates over-budget 1-10k to MD when department monthly quota would be exceeded", () => {
    const rec = getApprovalRecommendation({
      category: "general-purchase",
      amount: 5000,
      budgetStatus: "over-budget",
      departmentMonthlyOverBudgetTotal: 8000
    });
    expect(rec.recommendedFinalApprover).toBe("Managing Director");
    expect(rec.reason).toContain("10,000");
  });

  it("keeps over-budget 1-10k at GM when department monthly cumulative + amount stays within 10k", () => {
    const rec = getApprovalRecommendation({
      category: "general-purchase",
      amount: 5000,
      budgetStatus: "over-budget",
      departmentMonthlyOverBudgetTotal: 3000
    });
    expect(rec.recommendedFinalApprover).toBe("General Manager");
  });

  it("routes over-budget 10,001+ to MD regardless of monthly quota", () => {
    const rec = getApprovalRecommendation({
      category: "service-contract",
      amount: 25000,
      budgetStatus: "over-budget",
      departmentMonthlyOverBudgetTotal: 0
    });
    expect(rec.recommendedFinalApprover).toBe("Managing Director");
  });

  it("routes service-contract/general-purchase at exact 10,000 boundary to Manager", () => {
    expect(
      getApprovalLevel({ category: "service-contract", amount: 10000, budgetStatus: "in-budget" })
    ).toBe("Manager / Top Section");
    expect(
      getApprovalLevel({ category: "general-purchase", amount: 10000, budgetStatus: "in-budget" })
    ).toBe("Manager / Top Section");
  });

  it("routes service-contract/general-purchase at 10,001 to GM", () => {
    expect(
      getApprovalLevel({ category: "service-contract", amount: 10001, budgetStatus: "in-budget" })
    ).toBe("General Manager");
  });

  it("routes service-contract/general-purchase at exactly 50,000 to GM and at 50,001 to MD", () => {
    expect(
      getApprovalLevel({ category: "service-contract", amount: 50000, budgetStatus: "in-budget" })
    ).toBe("General Manager");
    expect(
      getApprovalLevel({ category: "service-contract", amount: 50001, budgetStatus: "in-budget" })
    ).toBe("Managing Director");
  });

  it("routes fixed-asset in-budget at exactly 100,000 to GM and above to MD", () => {
    expect(
      getApprovalLevel({
        category: "fixed-asset",
        amount: 100000,
        budgetStatus: "in-budget"
      })
    ).toBe("General Manager");
    expect(
      getApprovalLevel({
        category: "fixed-asset",
        amount: 100001,
        budgetStatus: "in-budget"
      })
    ).toBe("Managing Director");
  });
});

describe("buildApprovalFlow", () => {
  it("includes every intermediate level by default (stair pattern)", () => {
    expect(buildApprovalFlow("Managing Director")).toEqual([
      "Manager / Top Section",
      "General Manager",
      "Managing Director"
    ]);
  });

  it("skips intermediates when respectChosenOnly is true (Manager step still mandatory)", () => {
    expect(
      buildApprovalFlow("Managing Director", { respectChosenOnly: true })
    ).toEqual(["Manager / Top Section", "Managing Director"]);
  });

  it("returns just Manager step when chosen final approver is Manager", () => {
    expect(buildApprovalFlow("Manager / Top Section")).toEqual([
      "Manager / Top Section"
    ]);
  });
});

describe("analyzeApprovalRoute", () => {
  it("marks the default stair route as recommended and does not require a reason", () => {
    expect(
      analyzeApprovalRoute("Managing Director", [
        "Manager / Top Section",
        "General Manager",
        "Managing Director"
      ])
    ).toMatchObject({
      mode: "recommended",
      requiresReason: false
    });
  });

  it("requires a reason when the selected route skips an intermediate step", () => {
    expect(
      analyzeApprovalRoute("Managing Director", [
        "Manager / Top Section",
        "Managing Director"
      ])
    ).toMatchObject({
      mode: "exception",
      requiresReason: true
    });
  });

  it("requires a reason when the selected route ends below the recommendation", () => {
    expect(
      analyzeApprovalRoute("General Manager", ["Manager / Top Section"])
    ).toMatchObject({
      mode: "exception",
      requiresReason: true
    });
  });

  it("marks a route above the recommendation as escalated without requiring a reason", () => {
    expect(
      analyzeApprovalRoute("General Manager", [
        "Manager / Top Section",
        "General Manager",
        "Managing Director"
      ])
    ).toMatchObject({
      mode: "escalated",
      requiresReason: false
    });
  });

  it("marks Manager-recommended route escalated to GM or MD without requiring a reason", () => {
    expect(
      analyzeApprovalRoute("Manager / Top Section", ["Manager / Top Section", "General Manager"])
    ).toMatchObject({ mode: "escalated", requiresReason: false });
    expect(
      analyzeApprovalRoute("Manager / Top Section", [
        "Manager / Top Section",
        "General Manager",
        "Managing Director"
      ])
    ).toMatchObject({ mode: "escalated", requiresReason: false });
  });
});

describe("dashboard metrics", () => {
  it("summarizes the seeded memo queue for the dashboard", () => {
    expect(getDashboardMetrics(seedMemos)).toEqual({
      total: 8,
      pending: 3,
      approved: 3,
      rejected: 1,
      averageCycleHours: 15
    });
  });

  it("returns zero averageCycleHours on empty memo list without NaN", () => {
    expect(getDashboardMetrics([])).toEqual({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      averageCycleHours: 0
    });
  });
});
