// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { MemoFormFieldsResult } from "./useMemoFormFields";
import { useMemoSubmit } from "./useMemoSubmit";

vi.mock("@/lib/toast", () => ({ showErrorToast: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeFields(overrides: Partial<MemoFormFieldsResult> = {}): MemoFormFieldsResult {
  return {
    issuer: { name: "สมชาย ใจดี", department: "IT", role: "Requester" },
    reviseMemo: null,
    isRevisionMode: false,
    subject: "เรื่องทดสอบ",
    category: "general-purchase",
    itemSubcategoryId: undefined,
    itemSubcategoryLabel: undefined,
    department: "IT",
    amount: 1000,
    description: "รายละเอียด",
    closingRemark: "",
    budgetStatus: "in-budget",
    accountCode: "",
    budgetPlan: 0,
    budgetUsed: 0,
    requestItems: [{ id: "1", name: "กระดาษ", unit: "รีม", qty: 1, unitPrice: 1000 }],
    priceComparisons: [{ id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true }],
    selectedVendor: { id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true },
    selectedNotLowest: false,
    cleanVendorReason: "",
    effectiveIsPriceAdjustment: false,
    priceAdjustmentReason: "",
    effectiveFollowsProductionPlan: false,
    effectiveIsDeadStock: false,
    showDeptMonthly: false,
    deptMonthlyOverBudgetTotal: 0,
    orderedReadRecipients: [],
    recommendation: { recommendedFinalApprover: "Manager / Top Section", reason: "", notifyMD: false, requiresMdReview: false },
    routeReview: { mode: "recommended", requiresReason: false, recommendedRoute: ["Manager / Top Section"] },
    selectedRoute: ["Manager / Top Section"],
    cleanOverrideReason: "",
    firstCheckingStep: "Manager / Top Section",
    canSubmitPending: true,
    // Unused-by-useMemoSubmit fields still required by the type; harmless placeholders.
    ...({} as Record<string, unknown>),
    ...overrides,
  } as unknown as MemoFormFieldsResult;
}

describe("useMemoSubmit", () => {
  it("does nothing when canSubmitPending is false", async () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(makeFields({ canSubmitPending: false }), {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push } as never,
      })
    );
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("no-ops Save Draft while in revision mode", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(makeFields({ isRevisionMode: true }), {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push: vi.fn() } as never,
      })
    );
    await act(async () => { await result.current.handleSubmit("draft"); });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches ADD_MEMO and navigates to /queue for a new pending memo", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const dispatch = vi.fn();
    const push = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(makeFields(), {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push } as never,
      })
    );
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADD_MEMO",
        memo: expect.objectContaining({
          title: "เรื่องทดสอบ",
          description: "รายละเอียด",
          closingRemark: undefined,
          requestItems: expect.arrayContaining([
            expect.objectContaining({ id: "1", name: "กระดาษ", unit: "รีม", qty: 1, unitPrice: 1000 })
          ]),
          requester: "สมชาย ใจดี",
          department: "IT",
          amount: 1000,
          category: "general-purchase",
        })
      })
    );
    expect(push).toHaveBeenCalledWith("/queue");
  });

  it("dispatches SUBMIT_REVISION and navigates to /queue in revision mode", async () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(makeFields({ isRevisionMode: true, reviseMemo: { id: "MEMO-9" } as never }), {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push } as never,
      })
    );
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SUBMIT_REVISION",
        id: "MEMO-9",
        title: "เรื่องทดสอบ",
        description: "รายละเอียด",
        closingRemark: undefined,
        requestItems: expect.arrayContaining([
          expect.objectContaining({ id: "1", name: "กระดาษ", unit: "รีม", qty: 1, unitPrice: 1000 })
        ]),
        department: "IT",
      })
    );
    expect(push).toHaveBeenCalledWith("/queue");
  });

  it("shows a validation toast and skips dispatch when the subject is blank", async () => {
    const { showErrorToast } = await import("@/lib/toast");
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(makeFields({ subject: "" }), {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push: vi.fn() } as never,
      })
    );
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(showErrorToast).toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("aborts before dispatch when attachment upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "storage full" }) }));
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(makeFields(), {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push: vi.fn() } as never,
      })
    );
    act(() => { result.current.addAttachmentFiles([new File(["x"], "quote.pdf", { type: "application/pdf" })]); });
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.current.attachmentError).toBe("storage full");
  });
});
