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
  it("defaults to blank fields for a brand-new memo", () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    expect(result.current.isRevisionMode).toBe(false);
    expect(result.current.subject).toBe("");
    expect(result.current.amount).toBe(0);
    expect(result.current.budgetStatus).toBe("in-budget");
    expect(result.current.priceComparisons).toHaveLength(1);
    expect(result.current.requestItems).toHaveLength(1);
  });

  it("prefills from reviseMemo when the memo is returned and requester matches", () => {
    const memo = makeMemo({ id: "MEMO-2", title: "ซื้อกระดาษ", amount: 2500, status: "returned" });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: "MEMO-2", user: makeUser() })
    );
    expect(result.current.isRevisionMode).toBe(true);
    expect(result.current.subject).toBe("ซื้อกระดาษ");
    expect(result.current.amount).toBe(2500);
    expect(result.current.reviseMemo?.id).toBe("MEMO-2");
  });

  it("does not enter revision mode for a rejected memo with disposition close", () => {
    const memo = makeMemo({ id: "MEMO-3", status: "rejected", rejectDisposition: "close" });
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [memo], reviseId: "MEMO-3", user: makeUser() })
    );
    expect(result.current.isRevisionMode).toBe(false);
  });

  it("removeVendorRow reassigns isSelected and refuses to go below 1 row", () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
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

  it("removeRequestItem refuses to go below 1 row", () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    const onlyId = result.current.requestItems[0].id;
    act(() => result.current.removeRequestItem(onlyId));
    expect(result.current.requestItems).toHaveLength(1);
  });

  it("applyBulkData writes only present keys; snapshotFormData reads them back", () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    act(() => result.current.applyBulkData({ title: "หัวข้อใหม่", amount: 5000 }));
    expect(result.current.subject).toBe("หัวข้อใหม่");
    expect(result.current.amount).toBe(5000);
    expect(result.current.department).toBe("IT"); // untouched key stays as-is

    const snapshot = result.current.snapshotFormData();
    expect(snapshot.title).toBe("หัวข้อใหม่");
    expect(snapshot.amount).toBe(5000);
  });

  it("recomputes the recommendation when category or amount changes", () => {
    const { result, rerender } = renderHook(
      ({ user }) => useMemoFormFields({ memos: [], reviseId: null, user }),
      { initialProps: { user: makeUser() } }
    );
    const before = result.current.recommendation.recommendedFinalApprover;
    act(() => result.current.applyBulkData({ category: "raw-material", amount: 50000 }));
    rerender({ user: makeUser() });
    expect(result.current.recommendation.recommendedFinalApprover).not.toBe(before);
  });
});
