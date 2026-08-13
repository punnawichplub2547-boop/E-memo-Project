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
    notifyNote: "",
    notifyNoteImageFiles: [],
    notifyAttachExcel: false,
    priceComparisons: [{ id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "ไม่สามารถต่อรองราคาได้", isSelected: true }],
    selectedVendor: { id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "ไม่สามารถต่อรองราคาได้", isSelected: true },
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

  it("blocks SUBMIT_REVISION when canSubmitPending is false because a selected row lacks a remark", async () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(
        makeFields({
          isRevisionMode: true,
          reviseMemo: { id: "MEMO-9" } as never,
          canSubmitPending: false,
          priceComparisons: [{ id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true }],
          selectedVendor: { id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true },
        }),
        {
          user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
          dispatch,
          router: { push } as never,
        }
      )
    );
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("dispatches ADD_MEMO for Save Draft even when the selected row has no discount or remark", async () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(
        makeFields({
          priceComparisons: [{ id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true }],
          selectedVendor: { id: "1", vendorName: "ACME", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true },
        }),
        {
          user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
          dispatch,
          router: { push } as never,
        }
      )
    );
    await act(async () => { await result.current.handleSubmit("draft"); });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADD_MEMO",
        memo: expect.objectContaining({ status: "draft" }),
      })
    );
    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("useMemoSubmit — notification short note", () => {
  it("uploads the note images and carries the note into ADD_MEMO", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ images: [{ id: "1", originalName: "a.png", storedName: "u-a.png", size: 5, mimeType: "image/png" }] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const fields = makeFields({
      notifyNote: "ด่วน ขอภายในวันนี้",
      notifyNoteImageFiles: [new File([new Uint8Array(5)], "a.png", { type: "image/png" })],
      notifyAttachExcel: true,
    });
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(fields, {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push: vi.fn() } as never,
      })
    );

    await act(async () => { await result.current.handleSubmit("pending"); });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/notify-note-images");
    const added = dispatch.mock.calls.find((c) => c[0].type === "ADD_MEMO")![0];
    expect(added.memo.notifyNote).toBe("ด่วน ขอภายในวันนี้");
    expect(added.memo.notifyNoteImages).toHaveLength(1);
    expect(added.memo.notifyAttachExcel).toBe(true);
  });

  it("does not call the upload route when there are no images", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const fields = makeFields({ notifyNote: "ข้อความล้วน", notifyNoteImageFiles: [] });
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(fields, {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push: vi.fn() } as never,
      })
    );

    await act(async () => { await result.current.handleSubmit("pending"); });

    const calledUpload = fetchMock.mock.calls.some((c) => String(c[0]).includes("notify-note-images"));
    expect(calledUpload).toBe(false);
  });

  it("blocks the submit when the note image upload fails — the note must not be lost silently", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: "too big" }) })) as unknown as typeof fetch;
    const fields = makeFields({
      notifyNote: "ด่วน",
      notifyNoteImageFiles: [new File([new Uint8Array(5)], "a.png", { type: "image/png" })],
    });
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(fields, {
        user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
        dispatch,
        router: { push: vi.fn() } as never,
      })
    );

    await act(async () => { await result.current.handleSubmit("pending"); });

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("useMemoSubmit — custom per-person route on revision", () => {
  const customPeople = [
    { userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
    { userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
  ];

  const renderWithRoute = (overrides: Partial<MemoFormFieldsResult>) => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoSubmit(
        makeFields({ isRevisionMode: true, reviseMemo: { id: "MEMO-9" } as never, ...overrides }),
        {
          user: { id: "u1", name: "สมชาย ใจดี", department: "IT", roleLabel: "Requester", roles: ["requester"] },
          dispatch,
          router: { push: vi.fn() } as never,
        }
      )
    );
    return { dispatch, result };
  };

  it("dispatches person tokens and the approver snapshot when the custom tab is active", async () => {
    const { dispatch, result } = renderWithRoute({
      routeSource: "custom",
      customRoutePeople: customPeople,
    } as never);
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SUBMIT_REVISION",
        selectedRoute: ["person:1#42", "person:2#7"],
        customRoute: [
          { stepKey: "person:1#42", userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
          { stepKey: "person:2#7", userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
        ],
      })
    );
  });

  it("keeps the Book1 level route and no customRoute when the custom tab is not active", async () => {
    const { dispatch, result } = renderWithRoute({
      routeSource: "book1",
      customRoutePeople: customPeople,
    } as never);
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SUBMIT_REVISION",
        selectedRoute: ["Manager / Top Section"],
        customRoute: undefined,
      })
    );
  });

  it("falls back to the Book1 route when the custom tab is active but empty", async () => {
    const { dispatch, result } = renderWithRoute({
      routeSource: "custom",
      customRoutePeople: [],
    } as never);
    await act(async () => { await result.current.handleSubmit("pending"); });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedRoute: ["Manager / Top Section"],
        customRoute: undefined,
      })
    );
  });
});
