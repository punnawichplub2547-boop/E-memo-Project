import { describe, expect, it } from "vitest";
import { buildMemoDraftRecord, type MemoDraftFields } from "./build-memo-draft-record";
import type { PriceComparison } from "./approval";

function makeFields(overrides: Partial<MemoDraftFields> = {}): MemoDraftFields {
  return {
    subject: "ขออนุมัติจัดซื้อกระดาษ",
    category: "general-purchase",
    itemSubcategoryId: undefined,
    itemSubcategoryLabel: undefined,
    department: "IT",
    amount: 1500,
    description: "  เหตุผล  ",
    closingRemark: "",
    budgetStatus: "in-budget",
    accountCode: "  ",
    budgetPlan: 10000,
    budgetUsed: 2000,
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
    routeReview: {
      recommendedRoute: ["Manager / Top Section", "General Manager"],
      mode: "recommended",
      requiresReason: false,
    },
    selectedRoute: ["Manager / Top Section", "General Manager"],
    cleanOverrideReason: "",
    firstCheckingStep: "Manager / Top Section",
    ...overrides,
  };
}

const opts = {
  id: "EM-20260806-101112-ABC",
  requester: "ผู้ดูแลระบบ E-Memo",
  status: "pending" as const,
  timestamp: "06 Aug 2026 10:11",
};

describe("buildMemoDraftRecord", () => {
  it("carries the identity and timestamps it is handed", () => {
    const memo = buildMemoDraftRecord(makeFields(), opts);
    expect(memo.id).toBe("EM-20260806-101112-ABC");
    expect(memo.requester).toBe("ผู้ดูแลระบบ E-Memo");
    expect(memo.status).toBe("pending");
    expect(memo.createdAt).toBe("06 Aug 2026 10:11");
    expect(memo.updatedAt).toBe("06 Aug 2026 10:11");
    expect(memo.cycleHours).toBe(0);
    expect(memo.workflowState).toBe("Issued");
  });

  it("starts the memo at the first step of the selected route", () => {
    const memo = buildMemoDraftRecord(makeFields({ firstCheckingStep: "Supervisor" }), opts);
    expect(memo.currentStep).toBe("Supervisor");
  });

  it("trims free text and drops it when only whitespace is left", () => {
    const memo = buildMemoDraftRecord(makeFields(), opts);
    expect(memo.description).toBe("เหตุผล");
    expect(memo.accountCode).toBeUndefined();
    expect(memo.closingRemark).toBeUndefined();
  });

  it("keeps only request-item rows that have a name or a price", () => {
    const memo = buildMemoDraftRecord(
      makeFields({
        requestItems: [
          { id: "a", name: "กระดาษ A4", qty: 1, unit: "รีม", unitPrice: 750 },
          { id: "b", name: "   ", qty: 0, unit: "", unitPrice: 0 },
          { id: "c", name: "", qty: 0, unit: "", unitPrice: 250 },
        ],
      }),
      opts,
    );
    expect(memo.requestItems?.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("records the selected vendor and only explains it when it is not the lowest", () => {
    const vendor = { id: "v2" } as PriceComparison;
    const cheapest = buildMemoDraftRecord(
      makeFields({ selectedVendor: vendor, selectedNotLowest: false, cleanVendorReason: "เหตุผล" }),
      opts,
    );
    expect(cheapest.selectedVendorId).toBe("v2");
    expect(cheapest.selectedVendorReason).toBeUndefined();

    const notLowest = buildMemoDraftRecord(
      makeFields({ selectedVendor: vendor, selectedNotLowest: true, cleanVendorReason: "ส่งของเร็วกว่า" }),
      opts,
    );
    expect(notLowest.selectedVendorReason).toBe("ส่งของเร็วกว่า");
  });

  it("passes the effective flags through, omitting the false ones", () => {
    const off = buildMemoDraftRecord(makeFields(), opts);
    expect(off.isPriceAdjustment).toBeUndefined();
    expect(off.followsProductionPlan).toBeUndefined();
    expect(off.isDeadStockOrSlowMovement).toBeUndefined();

    const on = buildMemoDraftRecord(
      makeFields({
        effectiveIsPriceAdjustment: true,
        priceAdjustmentReason: "  ราคาวัตถุดิบขึ้น  ",
        effectiveFollowsProductionPlan: true,
        effectiveIsDeadStock: true,
      }),
      opts,
    );
    expect(on.isPriceAdjustment).toBe(true);
    expect(on.followsProductionPlan).toBe(true);
    expect(on.isDeadStockOrSlowMovement).toBe(true);
    expect(on.priceAdjustmentReason).toBe("ราคาวัตถุดิบขึ้น");
  });

  it("includes the department monthly total only when the section is shown and non-zero", () => {
    expect(
      buildMemoDraftRecord(makeFields({ showDeptMonthly: false, deptMonthlyOverBudgetTotal: 9000 }), opts)
        .departmentMonthlyOverBudgetTotal,
    ).toBeUndefined();
    expect(
      buildMemoDraftRecord(makeFields({ showDeptMonthly: true, deptMonthlyOverBudgetTotal: 0 }), opts)
        .departmentMonthlyOverBudgetTotal,
    ).toBeUndefined();
    expect(
      buildMemoDraftRecord(makeFields({ showDeptMonthly: true, deptMonthlyOverBudgetTotal: 9000 }), opts)
        .departmentMonthlyOverBudgetTotal,
    ).toBe(9000);
  });

  it("only explains the route when the override actually requires a reason", () => {
    const plain = buildMemoDraftRecord(makeFields({ cleanOverrideReason: "เหตุผล" }), opts);
    expect(plain.routeOverrideReason).toBeUndefined();

    const overridden = buildMemoDraftRecord(
      makeFields({
        routeReview: { recommendedRoute: ["General Manager"], mode: "escalated", requiresReason: true },
        cleanOverrideReason: "ต้องให้ MD เห็น",
      }),
      opts,
    );
    expect(overridden.routeMode).toBe("escalated");
    expect(overridden.routeOverrideReason).toBe("ต้องให้ MD เห็น");
  });

  it("opens read actions only for a memo that is actually entering the workflow", () => {
    const fields = makeFields({ orderedReadRecipients: ["สมชาย", "สมหญิง"] });

    const pending = buildMemoDraftRecord(fields, opts);
    expect(pending.readRecipients).toEqual(["สมชาย", "สมหญิง"]);
    expect(pending.readActions).toEqual([
      { recipient: "สมชาย", status: "pending" },
      { recipient: "สมหญิง", status: "pending" },
    ]);

    // A draft (Save Draft, and the Excel preview) has not been sent to anyone,
    // so nobody owes it an acknowledgement yet.
    const draft = buildMemoDraftRecord(fields, { ...opts, status: "draft" });
    expect(draft.readRecipients).toEqual(["สมชาย", "สมหญิง"]);
    expect(draft.readActions).toBeUndefined();
  });

  it("attaches uploaded files when there are any", () => {
    expect(buildMemoDraftRecord(makeFields(), opts).attachments).toBeUndefined();
    const withFiles = buildMemoDraftRecord(makeFields(), {
      ...opts,
      attachments: [
        { id: "f1", originalName: "quote.pdf", storedName: "x-quote.pdf", size: 10, mimeType: "application/pdf", uploadedAt: "06 Aug 2026 10:11" },
      ],
    });
    expect(withFiles.attachments).toHaveLength(1);
  });

  it("accepts a blank id — the Excel preview has no memo number yet", () => {
    const memo = buildMemoDraftRecord(makeFields(), { ...opts, id: "", status: "draft" });
    expect(memo.id).toBe("");
    expect(memo.title).toBe("ขออนุมัติจัดซื้อกระดาษ");
  });
});

describe("custom route preview", () => {
  const people = [
    { userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
    { userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
  ];

  it("emits placeholder person tokens and a snapshot for the Excel preview", () => {
    const record = buildMemoDraftRecord(
      makeFields({ routeSource: "custom", customRoutePeople: people }),
      { ...opts, id: "", status: "draft" },
    );
    expect(record.selectedRoute).toEqual(["person:1#42", "person:2#7"]);
    expect(record.recommendedRoute).toEqual(["person:1#42", "person:2#7"]);
    expect(record.currentStep).toBe("person:1#42");
    expect(record.customRoute?.[1]).toEqual({
      stepKey: "person:2#7",
      userId: 7,
      name: "สุภาพร เจริญสุข",
      approvalLevel: "General Manager",
      department: "PD",
    });
    expect(record.routeMode).toBe("exception");
  });

  it("leaves the Book1 route untouched when routeSource is book1", () => {
    const record = buildMemoDraftRecord(
      makeFields({ routeSource: "book1", customRoutePeople: people }),
      { ...opts, id: "", status: "draft" },
    );
    expect(record.customRoute).toBeUndefined();
    expect(record.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
    expect(record.currentStep).toBe("Manager / Top Section");
    expect(record.routeMode).toBe("recommended");
  });

  it("leaves the Book1 route untouched when the custom tab has nobody picked", () => {
    const record = buildMemoDraftRecord(
      makeFields({ routeSource: "custom", customRoutePeople: [] }),
      { ...opts, id: "", status: "draft" },
    );
    expect(record.customRoute).toBeUndefined();
    expect(record.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
  });

  it("leaves an untouched (undefined) routeSource on the legacy Book1 path", () => {
    const record = buildMemoDraftRecord(makeFields(), opts);
    expect(record.customRoute).toBeUndefined();
    expect(record.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
  });

  it("keeps the override reason out of a custom route (the server writes its own)", () => {
    const record = buildMemoDraftRecord(
      makeFields({
        routeSource: "custom",
        customRoutePeople: people,
        routeReview: { recommendedRoute: ["Manager / Top Section"], mode: "recommended", requiresReason: true },
        cleanOverrideReason: "เหตุผลของโหมดเดิม",
      }),
      { ...opts, id: "", status: "draft" },
    );
    expect(record.routeOverrideReason).toBeUndefined();
  });
});
