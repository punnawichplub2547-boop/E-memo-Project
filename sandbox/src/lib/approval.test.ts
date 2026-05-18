import { describe, expect, it } from "vitest";
import {
  getApprovalLevel,
  getDashboardMetrics,
  seedMemos
} from "./approval";

describe("approval rules from HR&GA workbook", () => {
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
});

describe("dashboard metrics", () => {
  it("summarizes the seeded memo queue for the dashboard", () => {
    expect(getDashboardMetrics(seedMemos)).toEqual({
      total: 8,
      pending: 4,
      approved: 3,
      rejected: 1,
      averageCycleHours: 18
    });
  });
});
