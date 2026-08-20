// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { MemoRecord } from "@/lib/approval";
import type { PrototypeUser } from "@/lib/prototype-users";
import { useMemoFormFields } from "./useMemoFormFields";

function makeUser(overrides: Partial<PrototypeUser> = {}): PrototypeUser {
  return {
    id: "u1",
    name: "สมชาย ใจดี",
    department: "IT",
    roleLabel: "Requester",
    roles: ["requester"],
    ...overrides,
  };
}

function makeMemo(overrides: Partial<MemoRecord> = {}): MemoRecord {
  return {
    id: "MEMO-1",
    title: "เดิม",
    requester: "สมชาย ใจดี",
    department: "IT",
    category: "general-purchase",
    amount: 1000,
    status: "returned",
    currentStep: "Manager / Top Section",
    cycleHours: 0,
    createdAt: "2026-07-01 10:00",
    updatedAt: "2026-07-01 10:00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useMemoFormFields", () => {
  it("defaults to blank fields for a brand-new memo", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isRevisionMode).toBe(false);
    expect(result.current.subject).toBe("");
    expect(result.current.amount).toBe(0);
    expect(result.current.budgetStatus).toBe("in-budget");
    expect(result.current.priceComparisons).toHaveLength(1);
    expect(result.current.requestItems).toHaveLength(1);
  });

  it("prefills from reviseMemo when the memo is returned and requester matches", async () => {
    const memo = makeMemo({ id: "MEMO-2", title: "ซื้อกระดาษ", amount: 2500, status: "returned" });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: "MEMO-2", user: makeUser() })
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isRevisionMode).toBe(true);
    expect(result.current.subject).toBe("ซื้อกระดาษ");
    expect(result.current.amount).toBe(2500);
    expect(result.current.reviseMemo?.id).toBe("MEMO-2");
  });

  it("does not enter revision mode for a rejected memo with disposition close", async () => {
    const memo = makeMemo({ id: "MEMO-3", status: "rejected", rejectDisposition: "close" });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: "MEMO-3", user: makeUser() })
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isRevisionMode).toBe(false);
  });

  it("removeVendorRow reassigns isSelected and refuses to go below 1 row", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.addVendorRow());
    const [firstId, secondId] = result.current.priceComparisons.map(r => r.id);
    act(() => result.current.handleSelectVendor(firstId));
    act(() => result.current.removeVendorRow(firstId));
    expect(result.current.priceComparisons).toHaveLength(1);
    expect(result.current.priceComparisons[0].id).toBe(secondId);
    expect(result.current.priceComparisons[0].isSelected).toBe(true);

    act(() => result.current.removeVendorRow(secondId));
    expect(result.current.priceComparisons).toHaveLength(1);
  });

  it("removeRequestItem refuses to go below 1 row", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => {
      await Promise.resolve();
    });
    const onlyId = result.current.requestItems[0].id;
    act(() => result.current.removeRequestItem(onlyId));
    expect(result.current.requestItems).toHaveLength(1);
  });

  it("applyBulkData writes only present keys; snapshotFormData reads them back", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.applyBulkData({ title: "หัวข้อใหม่", amount: 5000 }));
    expect(result.current.subject).toBe("หัวข้อใหม่");
    expect(result.current.amount).toBe(5000);
    expect(result.current.department).toBe("IT"); // untouched key stays as-is

    const snapshot = result.current.snapshotFormData();
    expect(snapshot.title).toBe("หัวข้อใหม่");
    expect(snapshot.amount).toBe(5000);
  });

  it("recomputes the recommendation when category or amount changes", async () => {
    const { result, rerender } = renderHook(
      ({ user }) => useMemoFormFields({ memos: [], reviseId: null, user }),
      { initialProps: { user: makeUser() } }
    );
    await act(async () => {
      await Promise.resolve();
    });
    const before = result.current.recommendation.recommendedFinalApprover;
    act(() => result.current.applyBulkData({ category: "raw-material", amount: 50000 }));
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ user: makeUser() });
    expect(result.current.recommendation.recommendedFinalApprover).not.toBe(before);
  });

  it("converts a discount percent into baht on the matching row", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    const rowId = result.current.priceComparisons[0].id;
    act(() => { result.current.updateVendorRow(rowId, { offeredPrice: 2000 }); });
    act(() => { result.current.updateVendorDiscountPercent(rowId, 25); });

    expect(result.current.priceComparisons[0].discount).toBe(500);
  });

  it("fills the standard remark when the vendor cannot negotiate", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    const rowId = result.current.priceComparisons[0].id;
    act(() => { result.current.markVendorNonNegotiable(rowId); });

    expect(result.current.priceComparisons[0].remark).toBe("ไม่สามารถต่อรองราคาได้");
  });

  it("blocks pending submit while the selected vendor has no discount and no remark", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    const rowId = result.current.priceComparisons[0].id;
    act(() => { result.current.handleSelectVendor(rowId); });
    act(() => { result.current.updateVendorRow(rowId, { offeredPrice: 2000 }); });

    expect(result.current.rowsMissingNonNegotiableRemark).toHaveLength(1);
    expect(result.current.canSubmitPending).toBe(false);

    act(() => { result.current.markVendorNonNegotiable(rowId); });

    expect(result.current.rowsMissingNonNegotiableRemark).toHaveLength(0);
    expect(result.current.canSubmitPending).toBe(true);
  });

  it("does not block submit when the selected vendor gave a discount", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    const rowId = result.current.priceComparisons[0].id;
    act(() => { result.current.handleSelectVendor(rowId); });
    act(() => { result.current.updateVendorRow(rowId, { offeredPrice: 2000, discount: 100 }); });

    expect(result.current.canSubmitPending).toBe(true);
  });
});

describe("useMemoFormFields — custom route tab", () => {
  const person = (userId: number, name: string) => ({
    userId,
    name,
    approvalLevel: "Manager / Top Section",
    department: "IT",
  });

  it("starts on the Book1 tab and emits no custom route data", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    expect(result.current.routeSource).toBe("book1");
    expect(result.current.customRoutePeople).toEqual([]);
    expect(result.current.customRoute.customRoutePayload).toBeUndefined();
  });

  it("blocks pending submit on an empty custom route and unblocks once someone is picked", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    act(() => { result.current.customRoute.setRouteSource("custom"); });
    expect(result.current.canSubmitPending).toBe(false);

    act(() => { result.current.customRoute.addPerson(person(42, "สมชาย ใจดี")); });
    expect(result.current.canSubmitPending).toBe(true);
    expect(result.current.customRoutePeople.map((p) => p.userId)).toEqual([42]);
  });

  it("does not demand a Book1 override reason while the custom tab is active", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    // Routing a large request below its recommended approver is an exception, and
    // an exception normally cannot be submitted without a written reason.
    act(() => { result.current.setAmount(200000); });
    act(() => { result.current.setChosenApprover("Manager / Top Section"); });
    expect(result.current.routeReview.requiresReason).toBe(true);
    expect(result.current.canSubmitPending).toBe(false);

    act(() => { result.current.customRoute.setRouteSource("custom"); });
    act(() => { result.current.customRoute.addPerson(person(42, "สมชาย ใจดี")); });
    expect(result.current.canSubmitPending).toBe(true);
  });

  it("still demands the Book1 override reason on the Book1 tab", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    act(() => { result.current.setAmount(200000); });
    act(() => { result.current.setChosenApprover("Manager / Top Section"); });
    expect(result.current.routeReview.requiresReason).toBe(true);
    expect(result.current.canSubmitPending).toBe(false);
    act(() => { result.current.setRouteOverrideReason("เหตุผลเร่งด่วน"); });
    expect(result.current.canSubmitPending).toBe(true);
  });

  it("flags a self-pick using the signed-in user's real id without blocking submit", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser({ id: "auth-42" }) })
    );
    await act(async () => { await Promise.resolve(); });

    act(() => { result.current.customRoute.setRouteSource("custom"); });
    act(() => { result.current.customRoute.addPerson(person(42, "สมชาย ใจดี")); });
    expect(result.current.customRoute.selfPickedIndexes).toEqual([0]);
    expect(result.current.canSubmitPending).toBe(true);
  });

  it("reopens a revision that used a custom route on the custom tab, prefilled", async () => {
    const memo = makeMemo({
      selectedRoute: ["person:1#42", "person:2#7"],
      customRoute: [
        { stepKey: "person:1#42", userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
        { stepKey: "person:2#7", userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
      ],
    });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: memo.id, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isRevisionMode).toBe(true);
    expect(result.current.routeSource).toBe("custom");
    expect(result.current.customRoutePeople.map((p) => p.userId)).toEqual([42, 7]);
    expect(result.current.customRoute.customRoutePayload).toEqual([{ userId: 42 }, { userId: 7 }]);
  });

  it("reopens a revision that used a level route on the Book1 tab", async () => {
    const memo = makeMemo({ selectedRoute: ["Manager / Top Section", "General Manager"] });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: memo.id, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isRevisionMode).toBe(true);
    expect(result.current.routeSource).toBe("book1");
    expect(result.current.customRoutePeople).toEqual([]);
  });
});

describe("useMemoFormFields — free-form custom route override reason (fix round 1, F1)", () => {
  const managerPerson = (userId: number, name: string) => ({
    userId,
    name,
    approvalLevel: "Manager / Top Section",
    department: "IT",
  });
  const mdPerson = (userId: number, name: string) => ({
    userId,
    name,
    approvalLevel: "Managing Director",
    department: "IT",
  });

  it("blocks free-form submit when the custom route's final approver ranks below the Book1 recommendation, until a reason is given", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    act(() => { result.current.applyBulkData({ formMode: "freeform" }); });
    act(() => { result.current.setCategory("general-purchase"); });
    act(() => { result.current.setAmount(75000) }); // Book1-recommends "Managing Director" here
    act(() => { result.current.customRoute.setRouteSource("custom"); });
    act(() => { result.current.customRoute.addPerson(managerPerson(42, "สมชาย ใจดี")); }); // final approver ranks below MD

    expect(result.current.freeformCustomRouteRequiresReason).toBe(true);
    expect(result.current.canSubmitPending).toBe(false);
    // Task 10 fix round 2, G1: this is what drives FormModeToggle's warning —
    // must be true exactly while the reason is required AND still empty.
    expect(result.current.freeformRouteReasonMissing).toBe(true);

    act(() => { result.current.setRouteOverrideReason("MD มอบหมายให้ผู้จัดการอนุมัติแทนกรณีนี้"); });
    expect(result.current.canSubmitPending).toBe(true);
    expect(result.current.freeformRouteReasonMissing).toBe(false);
  });

  it("does not demand a reason in free-form mode when the custom route's final approver meets or exceeds the recommendation", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    act(() => { result.current.applyBulkData({ formMode: "freeform" }); });
    act(() => { result.current.setCategory("general-purchase"); });
    act(() => { result.current.setAmount(75000) }); // Book1-recommends "Managing Director" here
    act(() => { result.current.customRoute.setRouteSource("custom"); });
    act(() => { result.current.customRoute.addPerson(mdPerson(9, "อรทัย ศรีสุข")); }); // matches the recommendation

    expect(result.current.freeformCustomRouteRequiresReason).toBe(false);
    expect(result.current.canSubmitPending).toBe(true);
    expect(result.current.freeformRouteReasonMissing).toBe(false);
  });

  it("does NOT apply the free-form reason gate on the standard form's custom tab (V2 behavior unchanged)", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    // Same scenario as the first test above (big amount, low-ranked sole
    // approver) but formMode is left at its "standard" default.
    act(() => { result.current.setCategory("general-purchase"); });
    act(() => { result.current.setAmount(75000) });
    act(() => { result.current.customRoute.setRouteSource("custom"); });
    act(() => { result.current.customRoute.addPerson(managerPerson(42, "สมชาย ใจดี")); });

    expect(result.current.isFreeform).toBe(false);
    expect(result.current.freeformCustomRouteRequiresReason).toBe(false);
    expect(result.current.canSubmitPending).toBe(true);
    expect(result.current.freeformRouteReasonMissing).toBe(false);
  });
});

describe("useMemoFormFields — free-form template load / revision invariant (fix round 2, G2)", () => {
  // G2: loading a template saved from free-form mode calls applyBulkData with
  // formMode: "freeform" but never carried routeSource or customRoute people
  // (snapshotFormData never wrote them into a template) — before this fix that
  // landed on formMode "freeform" + routeSource "book1" + zero people, and
  // canSubmitCustom is vacuously true whenever routeSource isn't "custom", so
  // ส่งขออนุมัติ (Send to Approval) was reachable and would 400 after the
  // client had already dispatched ADD_MEMO and navigated away (the same loss
  // C1/C2/C3/F2 exist to prevent).

  it("applyBulkData loading formMode: freeform forces routeSource to custom (closes the source of the gap)", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    expect(result.current.routeSource).toBe("book1"); // sanity: starts on Book1, no people

    // Mirrors exactly what loading a free-form template sends: formMode only,
    // no routeSource/customRoute/people keys at all.
    act(() => { result.current.applyBulkData({ formMode: "freeform" }); });

    expect(result.current.isFreeform).toBe(true);
    expect(result.current.routeSource).toBe("custom");
  });

  it("canSubmitPending stays false when formMode is freeform with zero people, even if routeSource never became custom (defense in depth, second layer)", async () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    // Bypasses applyBulkData's own fix on purpose, to prove the canSubmitPending
    // gate blocks this combination independently of whichever path produced it —
    // exactly the "an as-yet-unknown other entry point" case the ruling asked for.
    act(() => { result.current.bodyBlocks.setFormMode("freeform"); });
    expect(result.current.routeSource).toBe("book1"); // deliberately NOT forced to custom here

    expect(result.current.isFreeform).toBe(true);
    expect(result.current.customRoute.people).toHaveLength(0);
    expect(result.current.canSubmitPending).toBe(false);
  });

  it("reopens a free-form revision with routeSource already on custom, prefilled with the original approvers", async () => {
    // The server (memo-body-blocks-server.ts) refuses to persist ANY free-form
    // memo — draft or pending — without a non-empty custom route, so any memo
    // that reaches "returned"/"rejected+revision-allowed" with formMode
    // "freeform" is guaranteed to already carry a non-empty customRoute. Traced
    // db-memos.ts:136 (customRoute is always hydrated from custom_route_json
    // for every read, unconditionally) and useMemoFormFields.ts's
    // revisionCustomPeople/customRoute-seeding block, which derives
    // initialSource "custom" purely from customRoute.length > 0 — independent
    // of formMode. This test locks that in as a regression guard.
    const memo = makeMemo({
      formMode: "freeform",
      bodyBlocks: [{ id: "b1", type: "paragraph", text: "เนื้อหา" }],
      selectedRoute: ["person:1#42"],
      customRoute: [
        { stepKey: "person:1#42", userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
      ],
    });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: memo.id, user: makeUser() })
    );
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isRevisionMode).toBe(true);
    expect(result.current.isFreeform).toBe(true);
    expect(result.current.routeSource).toBe("custom");
    expect(result.current.customRoutePeople.map((p) => p.userId)).toEqual([42]);
  });
});
