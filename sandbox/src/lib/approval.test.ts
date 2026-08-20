import { describe, expect, it } from "vitest";
import {
  analyzeApprovalRoute,
  buildApprovalFlow,
  computePriceRowTotals,
  discountAmountFromPercent,
  getApprovalLevel,
  getApprovalLevelRank,
  getApprovalRecommendation,
  getDashboardMetrics,
  needsNonNegotiableRemark,
  NON_NEGOTIABLE_REMARK,
  requiresOverrideReasonForCustomRoute,
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


  it("marks requiresMdReview true whenever notifyMD is true (same trigger)", () => {
    const raw = getApprovalRecommendation({
      category: "raw-material",
      amount: 9000,
      budgetStatus: "in-budget",
      isPriceAdjustment: true
    });
    expect(raw.requiresMdReview).toBe(true);

    const gp = getApprovalRecommendation({
      category: "general-purchase",
      amount: 5000,
      budgetStatus: "in-budget",
      isPriceAdjustment: true
    });
    expect(gp.requiresMdReview).toBe(false);
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

describe("requiresOverrideReasonForCustomRoute", () => {
  // Task 10 fix round 1, F1: the free-form form's custom route is a list of
  // people, not a Book1 ladder, so this checks only the FINAL person's
  // recorded approval_level against the recommendation — not the whole route.
  it("does not require a reason with no people picked yet (canSubmitCustom blocks submit first)", () => {
    expect(requiresOverrideReasonForCustomRoute("General Manager", [])).toBe(false);
  });

  it("does not require a reason when the final approver matches the recommendation", () => {
    expect(
      requiresOverrideReasonForCustomRoute("General Manager", [
        { approvalLevel: "Manager / Top Section" },
        { approvalLevel: "General Manager" },
      ])
    ).toBe(false);
  });

  it("does not require a reason when the final approver outranks the recommendation (escalation)", () => {
    expect(
      requiresOverrideReasonForCustomRoute("Manager / Top Section", [
        { approvalLevel: "Managing Director" },
      ])
    ).toBe(false);
  });

  it("requires a reason when the final approver is ranked below the recommendation", () => {
    expect(
      requiresOverrideReasonForCustomRoute("Managing Director", [
        { approvalLevel: "General Manager" },
        { approvalLevel: "Manager / Top Section" },
      ])
    ).toBe(true);
  });

  it("only looks at the LAST person — an earlier low-ranked checker does not trigger the reason", () => {
    expect(
      requiresOverrideReasonForCustomRoute("General Manager", [
        { approvalLevel: "Manager / Top Section" },
        { approvalLevel: "General Manager" },
      ])
    ).toBe(false);
  });

  it("requires a reason when the final approver's level is null (unverifiable — conservative default)", () => {
    expect(
      requiresOverrideReasonForCustomRoute("Manager / Top Section", [
        { approvalLevel: null },
      ])
    ).toBe(true);
  });

  it("requires a reason when the final approver's level is unrecognized text", () => {
    expect(
      requiresOverrideReasonForCustomRoute("Manager / Top Section", [
        { approvalLevel: "some unrecognized value" },
      ])
    ).toBe(true);
  });
});

describe("Supervisor pre-Manager check step", () => {
  // Supervisor is an optional dept-scoped check step prepended before the mandatory
  // Manager step. It is NOT part of the rank ladder (approvalLevels array) — the
  // Book1 amount/budget matrix knows nothing about it. analyzeApprovalRoute must
  // strip it from BOTH sides before comparing, or a route that only added a
  // legitimate Supervisor prefix would look like a false "exception".
  it("getApprovalLevelRank returns -1 for Supervisor (not on the rank ladder)", () => {
    expect(getApprovalLevelRank("Supervisor")).toBe(-1);
  });

  it("buildApprovalFlow never emits a Supervisor step", () => {
    expect(buildApprovalFlow("Managing Director")).not.toContain("Supervisor");
    expect(buildApprovalFlow("Manager / Top Section")).not.toContain("Supervisor");
    expect(buildApprovalFlow("Managing Director", { respectChosenOnly: true })).not.toContain("Supervisor");
  });

  it("treats a route with only a Supervisor prefix added as recommended (not exception)", () => {
    const review = analyzeApprovalRoute("Manager / Top Section", [
      "Supervisor",
      "Manager / Top Section",
    ]);
    expect(review.mode).toBe("recommended");
    expect(review.requiresReason).toBe(false);
  });

  it("strips Supervisor from a GM-recommended route and still reads as recommended", () => {
    const review = analyzeApprovalRoute("General Manager", [
      "Supervisor",
      "Manager / Top Section",
      "General Manager",
    ]);
    expect(review.mode).toBe("recommended");
    expect(review.requiresReason).toBe(false);
  });

  it("still flags a genuine exception even when a Supervisor prefix is present", () => {
    // Supervisor stripped → selected ["Manager / Top Section"] ends below the
    // GM recommendation → exception, requires reason.
    const review = analyzeApprovalRoute("General Manager", [
      "Supervisor",
      "Manager / Top Section",
    ]);
    expect(review.mode).toBe("exception");
    expect(review.requiresReason).toBe(true);
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

describe("discount percent helpers", () => {
  it("computes discount percent from baht against the offered price", () => {
    const { discountPercent } = computePriceRowTotals({ offeredPrice: 1000, discount: 100 });
    expect(discountPercent).toBe(10);
  });

  it("rounds discount percent to 2 decimals", () => {
    const { discountPercent } = computePriceRowTotals({ offeredPrice: 3000, discount: 1000 });
    expect(discountPercent).toBe(33.33);
  });

  it("returns 0 percent when the offered price is 0 (no divide-by-zero)", () => {
    const { discountPercent } = computePriceRowTotals({ offeredPrice: 0, discount: 500 });
    expect(discountPercent).toBe(0);
  });

  it("keeps discount percent independent of VAT", () => {
    const withVat = computePriceRowTotals({ offeredPrice: 1000, discount: 100, vatEnabled: true });
    const withoutVat = computePriceRowTotals({ offeredPrice: 1000, discount: 100, vatEnabled: false });
    expect(withVat.discountPercent).toBe(withoutVat.discountPercent);
    expect(withVat.discountPercent).toBe(10);
  });

  it("converts a percent back into a baht amount rounded to 2 decimals", () => {
    expect(discountAmountFromPercent(1000, 10)).toBe(100);
    expect(discountAmountFromPercent(1001, 33)).toBe(330.33);
  });

  it("clamps the percent-to-baht conversion between 0 and the offered price", () => {
    expect(discountAmountFromPercent(1000, -5)).toBe(0);
    expect(discountAmountFromPercent(1000, 150)).toBe(1000);
    expect(discountAmountFromPercent(0, 50)).toBe(0);
  });
});

describe("needsNonNegotiableRemark", () => {
  it("is true for the selected row with a price but no discount", () => {
    expect(needsNonNegotiableRemark({ offeredPrice: 1000, discount: 0, isSelected: true })).toBe(true);
  });

  it("is false when the row has a discount", () => {
    expect(needsNonNegotiableRemark({ offeredPrice: 1000, discount: 50, isSelected: true })).toBe(false);
  });

  it("is false for rows that are not the selected vendor", () => {
    expect(needsNonNegotiableRemark({ offeredPrice: 1000, discount: 0, isSelected: false })).toBe(false);
  });

  it("is false for an empty row that has no price yet", () => {
    expect(needsNonNegotiableRemark({ offeredPrice: 0, discount: 0, isSelected: true })).toBe(false);
  });

  it("exposes the exact Thai remark text used by the quick-fill button", () => {
    expect(NON_NEGOTIABLE_REMARK).toBe("ไม่สามารถต่อรองราคาได้");
  });
});
