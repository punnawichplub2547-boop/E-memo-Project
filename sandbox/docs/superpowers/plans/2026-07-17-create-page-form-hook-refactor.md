# Create Page Form Hook Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/app/create/page.tsx` (1,209 lines) into four focused hooks under `src/app/create/_hooks/` with no visual or behavioral change, closing out the P1 clean-code-audit item.

**Architecture:** Pure extraction. Each hook takes over one responsibility slice of the existing `CreatePageContent` component (form fields + derived values, templates, AI/PDF assist, submit) and `page.tsx` composes all five hooks (four new + the existing `useCreateMemoAssistant`), passing the exact same values into the exact same `_components/*` JSX it already renders.

**Tech Stack:** Next.js 16 / React 19 (client component), TypeScript, Vitest 2 + `@testing-library/react` 16 for hook tests.

## Global Constraints

- **No visual or markup changes.** Every `_components/*` file keeps receiving the exact same props it does today. JSX structure in `page.tsx` is unchanged except for `import`/hook-composition lines at the top.
- **No new features or behavior changes.** This is a copy-move refactor; every conditional, guard, and toast message is preserved verbatim.
- **`useCreateMemoAssistant.ts` is not touched or folded into the new hooks.**
- **Windows shell:** run all commands with `npm.cmd`, not `npm`.
- **Test runner:** `vitest run` (`npm.cmd test`). Global `vitest.config.ts` stays on `environment: "node"` — do not change it. New hook test files need a DOM, so each one opens with a per-file pragma: `// @vitest-environment jsdom` (first line, before imports). `jsdom` is not yet a dependency — Task 1 adds it.
- **Characterization testing, not fresh red-green TDD.** This work moves already-correct, already-shipped logic. Each task still follows write-test → run (fails on missing module) → implement → run (passes) → commit, but the "red" step is the import failing, not a logic gap — don't invent artificial partial implementations to force a deeper red state.
- **Verify before every commit that touches `page.tsx`:** `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` — all three, from `sandbox/`.
- **Manual smoke test required before calling the whole plan done** (no e2e exists in this repo) — see Task 6.
- Field/type names below are copied verbatim from `src/app/create/page.tsx` as it exists in this checkout (1,209 lines) and `src/lib/approval.ts`, `src/lib/prototype-users.ts`, `src/lib/db-templates.ts`. If those files have drifted since this plan was written, treat the live source as authoritative and adjust field lists accordingly — but keep every other constraint above.

---

## File Structure

**Create:**
- `src/app/create/_hooks/useMemoFormFields.ts` — all form/routing state + derived values + row helpers + `applyBulkData`/`snapshotFormData`
- `src/app/create/_hooks/useMemoFormFields.test.ts`
- `src/app/create/_hooks/useMemoTemplates.ts` — template fetch/load/save/delete
- `src/app/create/_hooks/useMemoTemplates.test.ts`
- `src/app/create/_hooks/useMemoAiAssist.ts` — AI draft suggest + PDF extract
- `src/app/create/_hooks/useMemoAiAssist.test.ts`
- `src/app/create/_hooks/useMemoSubmit.ts` — attachment upload + submit (draft/pending/revision)
- `src/app/create/_hooks/useMemoSubmit.test.ts`

**Modify:**
- `src/app/create/page.tsx` — becomes a thin composition of 5 hooks + the existing JSX
- `package.json` — add `jsdom` devDependency (Task 1)
- `D:\Hrproject\CLAUDE.md` — flip the P1 audit row for `create/page.tsx` to done (Task 6, outside the sandbox repo, no test/build implications)

---

### Task 1: `useMemoFormFields` hook

**Files:**
- Create: `src/app/create/_hooks/useMemoFormFields.ts`
- Create: `src/app/create/_hooks/useMemoFormFields.test.ts`
- Modify: `package.json` (add `jsdom` devDependency)

**Interfaces:**
- Consumes: `MemoRecord`, `PriceComparison`, `RequestItem`, `ApprovalCategory`, `ApprovalLevel`, `BudgetStatus`, `computePriceRowTotals`, `getApprovalRecommendation`, `buildApprovalFlow`, `analyzeApprovalRoute` from `@/lib/approval`; `coerceNonNegativeNumber`/`coercePositiveInteger` from `@/lib/number-input`; `newClientRowId` from `@/lib/client-row-id`; `canResubmitMemo`, `PrototypeUser` from `@/lib/prototype-users`; `ItemSubcategory` from `@/lib/item-subcategories`.
- Produces (consumed by Tasks 2–5):
  - `useMemoFormFields(input: { memos: MemoRecord[]; reviseId: string | null; user: PrototypeUser }): MemoFormFieldsResult`
  - `export type MemoFormFieldsResult = ReturnType<typeof useMemoFormFields>`
  - `applyBulkData(data: Record<string, unknown>): void` and `snapshotFormData(): Record<string, unknown>` (used by Task 2 and Task 3)

- [ ] **Step 1: Install `jsdom`**

Run: `npm.cmd install -D jsdom`
Expected: `package.json` `devDependencies` gains `"jsdom": "^25.x.x"` (or current major), `node_modules/jsdom` exists.

- [ ] **Step 2: Write the failing test file**

Create `src/app/create/_hooks/useMemoFormFields.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
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
    result.current.addVendorRow();
    const [firstId, secondId] = result.current.priceComparisons.map(r => r.id);
    result.current.handleSelectVendor(firstId);
    result.current.removeVendorRow(firstId);
    expect(result.current.priceComparisons).toHaveLength(1);
    expect(result.current.priceComparisons[0].id).toBe(secondId);
    expect(result.current.priceComparisons[0].isSelected).toBe(true);

    result.current.removeVendorRow(secondId);
    expect(result.current.priceComparisons).toHaveLength(1);
  });

  it("removeRequestItem refuses to go below 1 row", () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    const onlyId = result.current.requestItems[0].id;
    result.current.removeRequestItem(onlyId);
    expect(result.current.requestItems).toHaveLength(1);
  });

  it("applyBulkData writes only present keys; snapshotFormData reads them back", () => {
    const { result } = renderHook(() =>
      useMemoFormFields({ memos: [], reviseId: null, user: makeUser() })
    );
    result.current.applyBulkData({ title: "หัวข้อใหม่", amount: 5000 });
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
    result.current.applyBulkData({ category: "raw-material", amount: 50000 });
    rerender({ user: makeUser() });
    expect(result.current.recommendation.recommendedFinalApprover).not.toBe(before);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm.cmd test -- useMemoFormFields`
Expected: FAIL — `Cannot find module './useMemoFormFields'` (file doesn't exist yet).

- [ ] **Step 4: Write the hook implementation**

Create `src/app/create/_hooks/useMemoFormFields.ts`:

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analyzeApprovalRoute,
  ApprovalCategory,
  ApprovalLevel,
  buildApprovalFlow,
  BudgetStatus,
  computePriceRowTotals,
  getApprovalRecommendation,
  MemoRecord,
  PriceComparison,
  RequestItem,
} from "@/lib/approval";
import { coerceNonNegativeNumber, coercePositiveInteger } from "@/lib/number-input";
import { newClientRowId } from "@/lib/client-row-id";
import { canResubmitMemo, PrototypeUser } from "@/lib/prototype-users";
import type { ItemSubcategory } from "@/lib/item-subcategories";

function getEffectiveRequestQty(qty: number) {
  return qty > 0 ? qty : 1;
}

export interface UseMemoFormFieldsInput {
  memos: MemoRecord[];
  reviseId: string | null;
  user: PrototypeUser;
}

export function useMemoFormFields({ memos, reviseId, user }: UseMemoFormFieldsInput) {
  const issuer = {
    name: user.name,
    department: user.department,
    role: user.roleLabel,
  };

  // Compute revision context before any useState so lazy initializers can reference it.
  // reviseMemo is null when reviseId is absent, not found, or not in a resubmittable state.
  const reviseMemo = reviseId ? (memos.find(m => m.id === reviseId) ?? null) : null;
  const isRevisionMode = reviseMemo !== null && (
    reviseMemo.status === "returned" ||
    (reviseMemo.status === "rejected" && reviseMemo.rejectDisposition === "revision-allowed")
  ) && canResubmitMemo(user, reviseMemo);

  // ── Content fields — seed from reviseMemo in revision mode, else use defaults ──
  const [subject, setSubject] = useState(() =>
    isRevisionMode ? (reviseMemo!.title ?? "") : ""
  );
  const [category, setCategory] = useState<ApprovalCategory>(() =>
    isRevisionMode ? (reviseMemo!.category ?? "general-purchase") : "general-purchase"
  );
  const [itemSubcategoryId, setItemSubcategoryId] = useState<number | undefined>(() =>
    isRevisionMode ? reviseMemo!.itemSubcategoryId : undefined
  );
  const [itemSubcategories, setItemSubcategories] = useState<ItemSubcategory[]>([]);
  const [itemSubcategoriesError, setItemSubcategoriesError] = useState("");
  const [department, setDepartment] = useState(() =>
    isRevisionMode ? (reviseMemo!.department ?? issuer.department) : issuer.department
  );
  const [amount, setAmount] = useState(() =>
    isRevisionMode ? (reviseMemo!.amount ?? 0) : 0
  );
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>(() =>
    isRevisionMode ? (reviseMemo!.budgetStatus ?? "in-budget") : "in-budget"
  );
  const [description, setDescription] = useState(() =>
    isRevisionMode ? (reviseMemo!.description ?? "") : ""
  );
  const [closingRemark, setClosingRemark] = useState(() =>
    isRevisionMode ? (reviseMemo!.closingRemark ?? "") : ""
  );
  const [isPriceAdjustment, setIsPriceAdjustment] = useState(() =>
    isRevisionMode ? (reviseMemo!.isPriceAdjustment ?? false) : false
  );
  const [followsProductionPlan, setFollowsProductionPlan] = useState(() =>
    isRevisionMode ? (reviseMemo!.followsProductionPlan ?? false) : false
  );
  const [isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement] = useState(() =>
    isRevisionMode ? (reviseMemo!.isDeadStockOrSlowMovement ?? false) : false
  );
  const [deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal] = useState(() =>
    isRevisionMode ? (reviseMemo!.departmentMonthlyOverBudgetTotal ?? 0) : 0
  );
  const [readRecipients, setReadRecipients] = useState<string[]>(() =>
    isRevisionMode ? (reviseMemo!.readRecipients ?? []) : []
  );
  const [accountCode, setAccountCode] = useState(() =>
    isRevisionMode ? (reviseMemo!.accountCode ?? "") : ""
  );
  const [budgetPlan, setBudgetPlan] = useState(() =>
    isRevisionMode ? (reviseMemo!.budgetPlan ?? 0) : 0
  );
  const [budgetUsed, setBudgetUsed] = useState(() =>
    isRevisionMode ? (reviseMemo!.budgetUsed ?? 0) : 0
  );
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>(() => {
    if (isRevisionMode && (reviseMemo!.priceComparisons?.length ?? 0) > 0) {
      return reviseMemo!.priceComparisons!;
    }
    return [{ id: "1", vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: true }];
  });
  const [selectedVendorReason, setSelectedVendorReason] = useState(() =>
    isRevisionMode ? (reviseMemo!.selectedVendorReason ?? "") : ""
  );
  const [requestItems, setRequestItems] = useState<RequestItem[]>(() => {
    if (isRevisionMode && (reviseMemo!.requestItems?.length ?? 0) > 0) {
      return reviseMemo!.requestItems!;
    }
    return [{ id: "1", name: "", unit: "ชิ้น", qty: 1, unitPrice: 0 }];
  });
  const [priceAdjustmentReason, setPriceAdjustmentReason] = useState(() =>
    isRevisionMode ? (reviseMemo!.priceAdjustmentReason ?? "") : ""
  );

  // ── Routing fields — always default to fresh recommendation (user decision) ──
  const [chosenApprover, setChosenApprover] = useState<ApprovalLevel | null>(null);
  const [skipGmStep, setSkipGmStep] = useState(false);
  const [routeOverrideReason, setRouteOverrideReason] = useState("");

  // ── Clock display state ──
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/item-subcategories?category=${encodeURIComponent(category)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((body: { items: ItemSubcategory[] }) => {
        if (!controller.signal.aborted) {
          setItemSubcategories(body.items);
          setItemSubcategoriesError("");
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setItemSubcategories([]);
        setItemSubcategoriesError("โหลดหมวดรายการย่อยไม่สำเร็จ");
      });
    return () => controller.abort();
  }, [category]);

  const supportsPriceAdjustment = category === "raw-material" || category === "fixed-asset";
  const supportsProductionPlan = category === "raw-material";
  const supportsDeadStock = category === "raw-material";
  const showDeptMonthly = budgetStatus !== "in-budget";

  const effectiveIsPriceAdjustment = supportsPriceAdjustment && isPriceAdjustment;
  const effectiveFollowsProductionPlan = supportsProductionPlan && followsProductionPlan;
  const effectiveIsDeadStock = supportsDeadStock && isDeadStockOrSlowMovement;

  const recommendation = useMemo(
    () =>
      getApprovalRecommendation({
        category, amount, budgetStatus,
        isPriceAdjustment: effectiveIsPriceAdjustment,
        followsProductionPlan: effectiveFollowsProductionPlan,
        isDeadStockOrSlowMovement: effectiveIsDeadStock,
        departmentMonthlyOverBudgetTotal: showDeptMonthly ? deptMonthlyOverBudgetTotal : 0,
      }),
    [category, amount, budgetStatus, effectiveIsPriceAdjustment, effectiveFollowsProductionPlan,
      effectiveIsDeadStock, deptMonthlyOverBudgetTotal, showDeptMonthly]
  );

  const effectiveApprover: ApprovalLevel = chosenApprover ?? recommendation.recommendedFinalApprover;
  const selectedRoute = useMemo(
    () =>
      effectiveApprover === "Managing Director" && skipGmStep
        ? buildApprovalFlow(effectiveApprover, { respectChosenOnly: true })
        : buildApprovalFlow(effectiveApprover),
    [effectiveApprover, skipGmStep]
  );
  const routeReview = useMemo(
    () =>
      analyzeApprovalRoute(
        recommendation.recommendedFinalApprover,
        selectedRoute
      ),
    [recommendation.recommendedFinalApprover, selectedRoute]
  );
  const tierClass = effectiveApprover === "Managing Director" ? "md" : effectiveApprover === "General Manager" ? "gm" : "mgr";
  const isOverridden = routeReview.mode !== "recommended";
  const budgetRemaining = budgetPlan - budgetUsed - amount;
  const cleanOverrideReason = routeOverrideReason.trim();
  const orderedReadRecipients = readRecipients;
  const firstCheckingStep = selectedRoute[0] ?? "Manager / Top Section";
  const selectedVendor = priceComparisons.find(r => r.isSelected) ?? priceComparisons[0];
  const selectedItemSubcategory = itemSubcategories.find(item => item.id === itemSubcategoryId);
  const itemSubcategoryLabel =
    selectedItemSubcategory?.labelTh ??
    (itemSubcategoryId === reviseMemo?.itemSubcategoryId ? reviseMemo?.itemSubcategoryLabel : undefined);
  const hasPricedVendor = priceComparisons.some(r => r.offeredPrice > 0);
  const validPrices = priceComparisons.filter(r => r.offeredPrice > 0).map(r => r.netPrice);
  const lowestNetPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const lowestOfferVendorNames = priceComparisons
    .filter((row) => row.offeredPrice > 0 && row.netPrice === lowestNetPrice)
    .map((row) => row.vendorName.trim())
    .filter(Boolean);
  const lowestOfferSummary =
    lowestNetPrice > 0
      ? `${lowestOfferVendorNames.length > 0 ? `${lowestOfferVendorNames.join(", ")} · ` : ""}฿${lowestNetPrice.toLocaleString()}`
      : "—";
  const selectedVendorSummary =
    selectedVendor && selectedVendor.vendorName.trim().length > 0
      ? `${selectedVendor.vendorName.trim()} · ฿${selectedVendor.netPrice.toLocaleString()}`
      : selectedVendor && selectedVendor.netPrice > 0
        ? `฿${selectedVendor.netPrice.toLocaleString()}`
        : "—";
  const selectedNotLowest = priceComparisons.length > 1 && lowestNetPrice > 0 && (selectedVendor?.netPrice ?? 0) > lowestNetPrice;
  const selectedVendorTotals = selectedVendor ? computePriceRowTotals(selectedVendor) : null;
  const selectedVendorVat = Boolean(selectedVendor?.vatEnabled);
  const selectedVendorVatAmount = selectedVendorTotals?.vatAmount ?? 0;
  const cleanVendorReason = selectedVendorReason.trim();
  const canSubmitPending = (!routeReview.requiresReason || cleanOverrideReason.length > 0) && (!selectedNotLowest || cleanVendorReason.length > 0);
  const currentDateLabel = useMemo(
    () => currentDateTime
      ? new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeStyle: "short" }).format(currentDateTime)
      : "",
    [currentDateTime]
  );
  const clockDateLabel = useMemo(
    () => currentDateTime
      ? new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(currentDateTime)
      : "",
    [currentDateTime]
  );
  const clockTimeLabel = useMemo(
    () => currentDateTime
      ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(currentDateTime)
      : "--:--:--",
    [currentDateTime]
  );
  const requestItemsGrandTotal = useMemo(
    () => requestItems.reduce((sum, r) => sum + Math.round(getEffectiveRequestQty(r.qty) * r.unitPrice), 0),
    [requestItems]
  );

  const addRequestItem = () => {
    setRequestItems(prev => [...prev, {
      id: newClientRowId(), name: "", unit: "ชิ้น", qty: 1, unitPrice: 0,
    }]);
  };
  const removeRequestItem = (id: string) => {
    setRequestItems(prev => prev.length === 1 ? prev : prev.filter(r => r.id !== id));
  };
  const updateRequestItem = (id: string, updates: Partial<Omit<RequestItem, "id">>) => {
    const normalizedUpdates = {
      ...updates,
      ...(updates.qty !== undefined ? { qty: coercePositiveInteger(updates.qty) } : {}),
      ...(updates.unitPrice !== undefined ? { unitPrice: coerceNonNegativeNumber(updates.unitPrice) } : {}),
    };
    setRequestItems(prev => prev.map(r => r.id === id ? { ...r, ...normalizedUpdates } : r));
  };

  const addVendorRow = () => {
    setPriceComparisons(prev => [...prev, {
      id: newClientRowId(), vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: false,
    }]);
  };
  const removeVendorRow = (id: string) => {
    setPriceComparisons(prev => {
      if (prev.length === 1) return prev;
      const removingSelected = prev.find(r => r.id === id)?.isSelected ?? false;
      const next = prev.filter(r => r.id !== id);
      if (removingSelected && next.length > 0) next[0] = { ...next[0], isSelected: true };
      return next;
    });
  };
  const updateVendorRow = (id: string, updates: Partial<PriceComparison>) => {
    setPriceComparisons(prev => prev.map(row => {
      if (row.id !== id) return row;
      const normalizedUpdates = {
        ...updates,
        ...(updates.offeredPrice !== undefined ? { offeredPrice: coerceNonNegativeNumber(updates.offeredPrice) } : {}),
        ...(updates.discount !== undefined ? { discount: coerceNonNegativeNumber(updates.discount) } : {}),
      };
      const merged: PriceComparison = {
        ...row,
        ...normalizedUpdates,
        // isSelected is owned by handleSelectVendor, not the per-field updater
        isSelected: row.isSelected,
      };
      const { netPrice } = computePriceRowTotals(merged);
      return { ...merged, netPrice };
    }));
  };
  const handleSelectVendor = (id: string) => {
    setPriceComparisons(prev => prev.map(row => ({ ...row, isSelected: row.id === id })));
    // Only wipe the override reason when the selected vendor actually changes.
    const currentSelected = priceComparisons.find(r => r.isSelected);
    if (currentSelected?.id !== id) setSelectedVendorReason("");
  };

  const applyBulkData = (data: Record<string, unknown>) => {
    if (!data) return;
    if (data.title) setSubject(data.title as string);
    if (data.category) {
      setCategory(data.category as ApprovalCategory);
      setItemSubcategoryId(data.itemSubcategoryId as number | undefined);
    }
    if (data.department) setDepartment(data.department as string);
    if (data.amount !== undefined) setAmount(data.amount as number);
    if (data.budgetStatus) setBudgetStatus(data.budgetStatus as BudgetStatus);
    if (data.description) setDescription(data.description as string);
    if (data.closingRemark) setClosingRemark(data.closingRemark as string);
    if (data.isPriceAdjustment !== undefined) setIsPriceAdjustment(data.isPriceAdjustment as boolean);
    if (data.followsProductionPlan !== undefined) setFollowsProductionPlan(data.followsProductionPlan as boolean);
    if (data.isDeadStockOrSlowMovement !== undefined) setIsDeadStockOrSlowMovement(data.isDeadStockOrSlowMovement as boolean);
    if (data.accountCode) setAccountCode(data.accountCode as string);
    if (data.budgetPlan !== undefined) setBudgetPlan(data.budgetPlan as number);
    if (data.budgetUsed !== undefined) setBudgetUsed(data.budgetUsed as number);
    if (data.priceComparisons && (data.priceComparisons as Array<unknown>).length > 0) {
      setPriceComparisons(data.priceComparisons as PriceComparison[]);
    }
    if (data.selectedVendorReason) setSelectedVendorReason(data.selectedVendorReason as string);
    if (data.requestItems && (data.requestItems as Array<unknown>).length > 0) {
      setRequestItems(data.requestItems as RequestItem[]);
    }
    if (data.priceAdjustmentReason) setPriceAdjustmentReason(data.priceAdjustmentReason as string);
    if (data.readRecipients) setReadRecipients(data.readRecipients as string[]);
  };

  const snapshotFormData = () => ({
    title: subject,
    category,
    itemSubcategoryId,
    department,
    amount,
    budgetStatus,
    description,
    closingRemark,
    isPriceAdjustment,
    followsProductionPlan,
    isDeadStockOrSlowMovement,
    accountCode,
    budgetPlan,
    budgetUsed,
    priceComparisons,
    selectedVendorReason,
    requestItems,
    priceAdjustmentReason,
    readRecipients,
  });

  return {
    issuer, reviseMemo, isRevisionMode,
    subject, setSubject,
    category, setCategory,
    itemSubcategoryId, setItemSubcategoryId,
    itemSubcategories, itemSubcategoriesError,
    department, setDepartment,
    amount, setAmount,
    budgetStatus, setBudgetStatus,
    description, setDescription,
    closingRemark, setClosingRemark,
    isPriceAdjustment, setIsPriceAdjustment,
    followsProductionPlan, setFollowsProductionPlan,
    isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement,
    deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal,
    readRecipients, setReadRecipients,
    accountCode, setAccountCode,
    budgetPlan, setBudgetPlan,
    budgetUsed, setBudgetUsed,
    priceComparisons, setPriceComparisons,
    selectedVendorReason, setSelectedVendorReason,
    requestItems, setRequestItems,
    priceAdjustmentReason, setPriceAdjustmentReason,
    chosenApprover, setChosenApprover,
    skipGmStep, setSkipGmStep,
    routeOverrideReason, setRouteOverrideReason,
    currentDateLabel, clockDateLabel, clockTimeLabel,
    supportsPriceAdjustment, supportsProductionPlan, supportsDeadStock, showDeptMonthly,
    effectiveIsPriceAdjustment, effectiveFollowsProductionPlan, effectiveIsDeadStock,
    recommendation,
    effectiveApprover,
    selectedRoute,
    routeReview,
    tierClass,
    isOverridden,
    budgetRemaining,
    cleanOverrideReason,
    orderedReadRecipients,
    firstCheckingStep,
    selectedVendor,
    itemSubcategoryLabel,
    hasPricedVendor,
    lowestNetPrice,
    lowestOfferSummary,
    selectedVendorSummary,
    selectedNotLowest,
    selectedVendorVat,
    selectedVendorVatAmount,
    cleanVendorReason,
    canSubmitPending,
    requestItemsGrandTotal,
    addRequestItem, removeRequestItem, updateRequestItem,
    addVendorRow, removeVendorRow, updateVendorRow, handleSelectVendor,
    applyBulkData, snapshotFormData,
  };
}

export type MemoFormFieldsResult = ReturnType<typeof useMemoFormFields>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm.cmd test -- useMemoFormFields`
Expected: PASS — 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/app/create/_hooks/useMemoFormFields.ts src/app/create/_hooks/useMemoFormFields.test.ts package.json package-lock.json
git commit -m "refactor(create): extract useMemoFormFields hook"
```

---

### Task 2: `useMemoTemplates` hook

**Files:**
- Create: `src/app/create/_hooks/useMemoTemplates.ts`
- Create: `src/app/create/_hooks/useMemoTemplates.test.ts`

**Interfaces:**
- Consumes: `MemoTemplate` type from `@/lib/db-templates`; `showErrorToast`/`showSuccessToast` from `@/lib/toast`; `applyBulkData`/`snapshotFormData` from Task 1's `MemoFormFieldsResult`.
- Produces (consumed by Task 5):
  - `useMemoTemplates(input: { isRevisionMode: boolean; applyBulkData: (data: Record<string, unknown>) => void; snapshotFormData: () => Record<string, unknown> })`
  - Returns `{ templates, templatesLoading, saveModalOpen, setSaveModalOpen, isSavingTemplate, handleLoadTemplate, handleSaveTemplate, handleDeleteTemplate }`

- [ ] **Step 1: Write the failing test file**

Create `src/app/create/_hooks/useMemoTemplates.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useMemoTemplates } from "./useMemoTemplates";

vi.mock("@/lib/toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useMemoTemplates", () => {
  it("skips the initial fetch in revision mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: true, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches templates on mount when not in revision mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ templates: [{ id: 1, userId: 1, name: "แม่แบบ A", templateJson: "{}", createdAt: "", updatedAt: "" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData: vi.fn() })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/templates");
    expect(result.current.templates).toHaveLength(1);
  });

  it("handleLoadTemplate forwards parsed data to applyBulkData", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ templates: [] }) }));
    const applyBulkData = vi.fn();
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData, snapshotFormData: vi.fn() })
    );
    const data = { title: "หัวข้อ", amount: 999 };
    act(() => result.current.handleLoadTemplate(data));
    expect(applyBulkData).toHaveBeenCalledWith(data);
  });

  it("handleSaveTemplate posts the snapshot and closes the modal on success", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }) // initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST save
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) }); // refetch GET
    vi.stubGlobal("fetch", fetchMock);
    const snapshotFormData = vi.fn().mockReturnValue({ title: "หัวข้อ" });
    const { result } = renderHook(() =>
      useMemoTemplates({ isRevisionMode: false, applyBulkData: vi.fn(), snapshotFormData })
    );
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      result.current.setSaveModalOpen(true);
      await result.current.handleSaveTemplate("แม่แบบใหม่");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/templates", expect.objectContaining({ method: "POST" }));
    expect(result.current.saveModalOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- useMemoTemplates`
Expected: FAIL — `Cannot find module './useMemoTemplates'`.

- [ ] **Step 3: Write the hook implementation**

Create `src/app/create/_hooks/useMemoTemplates.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { MemoTemplate } from "@/lib/db-templates";

export interface UseMemoTemplatesInput {
  isRevisionMode: boolean;
  applyBulkData: (data: Record<string, unknown>) => void;
  snapshotFormData: () => Record<string, unknown>;
}

export function useMemoTemplates({ isRevisionMode, applyBulkData, snapshotFormData }: UseMemoTemplatesInput) {
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error("Failed to fetch templates", e);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (!isRevisionMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTemplates();
    } else {
      setTemplatesLoading(false);
    }
  }, [isRevisionMode]);

  const handleLoadTemplate = (data: Record<string, unknown>) => {
    if (!data) return;
    applyBulkData(data);
    showSuccessToast("โหลดแม่แบบเรียบร้อยแล้ว");
  };

  const handleSaveTemplate = async (name: string) => {
    try {
      setIsSavingTemplate(true);
      const templateData = snapshotFormData();

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, template: templateData }),
      });

      if (res.ok) {
        showSuccessToast("บันทึกแม่แบบเรียบร้อยแล้ว");
        setSaveModalOpen(false);
        setTemplatesLoading(true);
        fetchTemplates();
      } else {
        const err = await res.json();
        showErrorToast(err.error || "บันทึกแม่แบบไม่สำเร็จ");
      }
    } catch (e) {
      console.error("Failed to save template", e);
      showErrorToast("ระบบเกิดข้อผิดพลาดในการบันทึกแม่แบบ");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccessToast("ลบแม่แบบเรียบร้อยแล้ว");
        setTemplatesLoading(true);
        fetchTemplates();
      } else {
        const err = await res.json();
        showErrorToast(err.error || "ลบแม่แบบไม่สำเร็จ");
      }
    } catch (e) {
      console.error("Failed to delete template", e);
      showErrorToast("ระบบเกิดข้อผิดพลาดในการลบแม่แบบ");
    }
  };

  return {
    templates, templatesLoading, saveModalOpen, setSaveModalOpen, isSavingTemplate,
    handleLoadTemplate, handleSaveTemplate, handleDeleteTemplate,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- useMemoTemplates`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/create/_hooks/useMemoTemplates.ts src/app/create/_hooks/useMemoTemplates.test.ts
git commit -m "refactor(create): extract useMemoTemplates hook"
```

---

### Task 3: `useMemoAiAssist` hook

**Files:**
- Create: `src/app/create/_hooks/useMemoAiAssist.ts`
- Create: `src/app/create/_hooks/useMemoAiAssist.test.ts`

**Interfaces:**
- Consumes: `ApprovalCategory`, `BudgetStatus`, `PriceComparison`, `RequestItem` from `@/lib/approval`; `coerceNonNegativeNumber`/`coercePositiveInteger` from `@/lib/number-input`; `newClientRowId` from `@/lib/client-row-id`; `applyBulkData` from Task 1.
- Produces (consumed by Task 5):
  - `useMemoAiAssist(input: { category: ApprovalCategory; amount: number; department: string; budgetStatus: BudgetStatus; priceComparisons: PriceComparison[]; requestItems: RequestItem[]; applyBulkData: (data: Record<string, unknown>) => void })`
  - Returns `{ isAiLoading, aiError, setAiError, isPdfLoading, pdfError, setPdfError, pdfInputRef, handleAiSuggest, handlePdfUpload }`

- [ ] **Step 1: Write the failing test file**

Create `src/app/create/_hooks/useMemoAiAssist.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PriceComparison, RequestItem } from "@/lib/approval";
import { useMemoAiAssist } from "./useMemoAiAssist";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const baseInput = {
  category: "general-purchase" as const,
  amount: 1000,
  department: "IT",
  budgetStatus: "in-budget" as const,
};

const blankVendorRow: PriceComparison[] = [
  { id: "1", vendorName: "", offeredPrice: 0, discount: 0, vatEnabled: false, netPrice: 0, remark: "", isSelected: true },
];
const blankRequestItem: RequestItem[] = [{ id: "1", name: "", unit: "ชิ้น", qty: 1, unitPrice: 0 }];

describe("useMemoAiAssist — AI draft", () => {
  it("calls applyBulkData with subject/description on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ subject: "หัวข้อ AI", description: "รายละเอียด AI" }) }));
    const applyBulkData = vi.fn();
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData,
    }));
    await act(async () => { await result.current.handleAiSuggest(); });
    expect(applyBulkData).toHaveBeenCalledWith({ title: "หัวข้อ AI", description: "รายละเอียด AI" });
    expect(result.current.aiError).toBeNull();
  });

  it.each([
    ["not_configured", "ยังไม่ได้ตั้งค่า THAILLM_API_KEY ใน .env.local"],
    ["quota_exceeded", "Rate limit — รอ 1 นาทีแล้วลองใหม่"],
    ["parse_error", "AI ตอบผิดรูปแบบ — ลองใหม่อีกครั้ง"],
    ["something_else", "AI ไม่พร้อมใช้งานขณะนี้"],
  ])("sets the right Thai error message for %s", async (error, expectedPrefix) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error }) }));
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData: vi.fn(),
    }));
    await act(async () => { await result.current.handleAiSuggest(); });
    expect(result.current.aiError).toContain(expectedPrefix);
  });
});

describe("useMemoAiAssist — PDF extract", () => {
  it.each([
    ["pdf_only", "รองรับเฉพาะไฟล์ PDF เท่านั้น"],
    ["file_too_large", "ไฟล์ใหญ่เกิน 10 MB"],
    ["no_text_in_pdf", "PDF นี้ไม่มีข้อความ (อาจเป็น scan) — กรอกด้วยตนเอง"],
    ["something_else", "ดึงข้อมูลจาก PDF ไม่สำเร็จ — ลองใหม่"],
  ])("sets the right Thai error message for %s", async (error, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error }) }));
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData: vi.fn(),
    }));
    await act(async () => { await result.current.handlePdfUpload(new File(["x"], "quote.pdf")); });
    expect(result.current.pdfError).toBe(expected);
  });

  it("replaces the blank first vendor row instead of appending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ vendor: "ACME", totalAmount: 5000, items: [] }),
    }));
    const applyBulkData = vi.fn();
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: blankVendorRow, requestItems: blankRequestItem, applyBulkData,
    }));
    await act(async () => { await result.current.handlePdfUpload(new File(["x"], "quote.pdf")); });
    const call = applyBulkData.mock.calls[0][0];
    expect(call.priceComparisons).toHaveLength(1);
    expect(call.priceComparisons[0].vendorName).toBe("ACME");
  });

  it("appends a new vendor row when the existing rows already have data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ vendor: "ACME", totalAmount: 5000, items: [] }),
    }));
    const existingRows: PriceComparison[] = [
      { id: "1", vendorName: "เดิม", offeredPrice: 1000, discount: 0, vatEnabled: false, netPrice: 1000, remark: "", isSelected: true },
    ];
    const applyBulkData = vi.fn();
    const { result } = renderHook(() => useMemoAiAssist({
      ...baseInput, priceComparisons: existingRows, requestItems: blankRequestItem, applyBulkData,
    }));
    await act(async () => { await result.current.handlePdfUpload(new File(["x"], "quote.pdf")); });
    const call = applyBulkData.mock.calls[0][0];
    expect(call.priceComparisons).toHaveLength(2);
    expect(call.priceComparisons[0].isSelected).toBe(false);
    expect(call.priceComparisons[1].vendorName).toBe("ACME");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- useMemoAiAssist`
Expected: FAIL — `Cannot find module './useMemoAiAssist'`.

- [ ] **Step 3: Write the hook implementation**

Create `src/app/create/_hooks/useMemoAiAssist.ts`:

```ts
"use client";

import { useRef, useState } from "react";
import { ApprovalCategory, BudgetStatus, PriceComparison, RequestItem } from "@/lib/approval";
import { coerceNonNegativeNumber, coercePositiveInteger } from "@/lib/number-input";
import { newClientRowId } from "@/lib/client-row-id";

export interface UseMemoAiAssistInput {
  category: ApprovalCategory;
  amount: number;
  department: string;
  budgetStatus: BudgetStatus;
  priceComparisons: PriceComparison[];
  requestItems: RequestItem[];
  applyBulkData: (data: Record<string, unknown>) => void;
}

export function useMemoAiAssist({
  category, amount, department, budgetStatus, priceComparisons, requestItems, applyBulkData,
}: UseMemoAiAssistInput) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleAiSuggest = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount, department, budgetStatus }),
      });
      const data = await res.json();
      if (data.error === "not_configured") {
        setAiError("ยังไม่ได้ตั้งค่า THAILLM_API_KEY ใน .env.local");
      } else if (data.error === "quota_exceeded") {
        setAiError("Rate limit — รอ 1 นาทีแล้วลองใหม่");
      } else if (data.error === "parse_error") {
        setAiError("AI ตอบผิดรูปแบบ — ลองใหม่อีกครั้ง");
      } else if (data.error) {
        setAiError(`AI ไม่พร้อมใช้งานขณะนี้${data.detail ? ` (${data.detail})` : ""}`);
      } else {
        applyBulkData({ title: data.subject, description: data.description });
      }
    } catch {
      setAiError("เชื่อมต่อ AI ไม่ได้");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setPdfError(null);
    setIsPdfLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pdf-extract", { method: "POST", body: form });
      const data = await res.json();
      if (data.error === "not_configured") {
        setPdfError("ยังไม่ได้ตั้งค่า AI API key");
      } else if (data.error === "quota_exceeded") {
        setPdfError("Rate limit — รอ 1 นาทีแล้วลองใหม่");
      } else if (data.error === "pdf_only") {
        setPdfError("รองรับเฉพาะไฟล์ PDF เท่านั้น");
      } else if (data.error === "file_too_large") {
        setPdfError("ไฟล์ใหญ่เกิน 10 MB");
      } else if (data.error === "no_text_in_pdf") {
        setPdfError("PDF นี้ไม่มีข้อความ (อาจเป็น scan) — กรอกด้วยตนเอง");
      } else if (data.error) {
        setPdfError("ดึงข้อมูลจาก PDF ไม่สำเร็จ — ลองใหม่");
      } else {
        const bulk: Record<string, unknown> = {};
        // Pre-fill vendor row
        if (data.vendor || data.items?.length > 0) {
          const totalFromItems = (data.items ?? []).reduce(
            (s: number, it: { qty: number; unitPrice: number }) =>
              s + Math.round(coercePositiveInteger(it.qty) * coerceNonNegativeNumber(it.unitPrice)),
            0
          );
          const vendorPrice = coerceNonNegativeNumber(data.totalAmount || totalFromItems);
          const isFirstBlank =
            priceComparisons.length === 1 &&
            !priceComparisons[0].vendorName &&
            priceComparisons[0].offeredPrice === 0;
          // VAT defaults to disabled — extracted PDF totals are ambiguous re: VAT inclusion.
          // User can toggle the per-row VAT 7% pill if the quote explicitly excludes VAT.
          const newVendorRow: PriceComparison = {
            id: newClientRowId(),
            vendorName: data.vendor ?? "",
            offeredPrice: vendorPrice,
            discount: 0,
            vatEnabled: false,
            netPrice: vendorPrice,
            remark: file.name,
            isSelected: true,
          };
          bulk.priceComparisons = isFirstBlank
            ? [newVendorRow]
            : [...priceComparisons.map(r => ({ ...r, isSelected: false })), newVendorRow];
        }
        // Pre-fill request items
        if (Array.isArray(data.items) && data.items.length > 0) {
          const isFirstItemBlank =
            requestItems.length === 1 && !requestItems[0].name && requestItems[0].unitPrice === 0;
          const newItems = data.items.map((it: { name: string; qty: number; unit: string; unitPrice: number }) => ({
            id: newClientRowId(),
            name: it.name,
            unit: it.unit || "ชิ้น",
            qty: coercePositiveInteger(it.qty),
            unitPrice: coerceNonNegativeNumber(it.unitPrice),
          }));
          bulk.requestItems = isFirstItemBlank ? newItems : [...requestItems, ...newItems];
        }
        if (Object.keys(bulk).length > 0) applyBulkData(bulk);
      }
    } catch {
      setPdfError("เชื่อมต่อ server ไม่ได้");
    } finally {
      setIsPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  return {
    isAiLoading, aiError, setAiError,
    isPdfLoading, pdfError, setPdfError,
    pdfInputRef,
    handleAiSuggest, handlePdfUpload,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- useMemoAiAssist`
Expected: PASS — 11 tests green (1 + 4 + 4 + 2).

- [ ] **Step 5: Commit**

```bash
git add src/app/create/_hooks/useMemoAiAssist.ts src/app/create/_hooks/useMemoAiAssist.test.ts
git commit -m "refactor(create): extract useMemoAiAssist hook"
```

---

### Task 4: `useMemoSubmit` hook

**Files:**
- Create: `src/app/create/_hooks/useMemoSubmit.ts`
- Create: `src/app/create/_hooks/useMemoSubmit.test.ts`

**Interfaces:**
- Consumes: `MemoAttachment`, `ReadAction` from `@/lib/approval`; `isAllowedAttachmentFile`/`MAX_ATTACHMENT_BYTES` from `@/lib/attachments`; `formatTimestamp` from `@/lib/format-timestamp`; `generateMemoId` from `@/lib/memo-id`; `validateMemoFormForApproval` from `@/lib/validate-memo-form`; `showErrorToast` from `@/lib/toast`; `useMemos` from `@/lib/memo-store` (type-only, for the `dispatch` type); `PrototypeUser` from `@/lib/prototype-users`; `MemoFormFieldsResult` from Task 1.
- Produces (consumed by Task 5):
  - `useMemoSubmit(fields: MemoFormFieldsResult, deps: { user: PrototypeUser; dispatch: ReturnType<typeof useMemos>["dispatch"]; router: ReturnType<typeof useRouter> })`
  - Returns `{ attachmentFiles, attachmentError, isSubmitting, addAttachmentFiles, removeAttachmentFile, handleSubmit }`

- [ ] **Step 1: Write the failing test file**

Create `src/app/create/_hooks/useMemoSubmit.test.ts`:

```ts
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
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ADD_MEMO" }));
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
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "SUBMIT_REVISION", id: "MEMO-9" }));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- useMemoSubmit`
Expected: FAIL — `Cannot find module './useMemoSubmit'`.

- [ ] **Step 3: Write the hook implementation**

Create `src/app/create/_hooks/useMemoSubmit.ts`:

```ts
"use client";

import { useState } from "react";
import type { useRouter } from "next/navigation";
import { MemoAttachment, ReadAction } from "@/lib/approval";
import { isAllowedAttachmentFile, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { formatTimestamp } from "@/lib/format-timestamp";
import { generateMemoId } from "@/lib/memo-id";
import { validateMemoFormForApproval } from "@/lib/validate-memo-form";
import { showErrorToast } from "@/lib/toast";
import type { useMemos } from "@/lib/memo-store";
import type { PrototypeUser } from "@/lib/prototype-users";
import type { MemoFormFieldsResult } from "./useMemoFormFields";

export interface UseMemoSubmitDeps {
  user: PrototypeUser;
  dispatch: ReturnType<typeof useMemos>["dispatch"];
  router: ReturnType<typeof useRouter>;
}

export function useMemoSubmit(fields: MemoFormFieldsResult, { user, dispatch, router }: UseMemoSubmitDeps) {
  const {
    isRevisionMode, reviseMemo,
    subject, category, itemSubcategoryId, itemSubcategoryLabel, department, amount,
    description, closingRemark, budgetStatus, accountCode, budgetPlan, budgetUsed,
    requestItems, priceComparisons, selectedVendor, selectedNotLowest, cleanVendorReason,
    effectiveIsPriceAdjustment, priceAdjustmentReason, effectiveFollowsProductionPlan,
    effectiveIsDeadStock, showDeptMonthly, deptMonthlyOverBudgetTotal, orderedReadRecipients,
    recommendation, routeReview, selectedRoute, cleanOverrideReason, firstCheckingStep, canSubmitPending,
  } = fields;

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAttachmentFiles = (files: File[]) => {
    setAttachmentError(null);
    const invalid = files.find((file) => file.size > MAX_ATTACHMENT_BYTES || !isAllowedAttachmentFile(file.name, file.type));
    if (invalid) {
      setAttachmentError(`${invalid.name} is not allowed or exceeds 10 MB.`);
      return;
    }
    setAttachmentFiles((prev) => [...prev, ...files]);
  };

  const removeAttachmentFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  const uploadSelectedAttachments = async (memoId: string): Promise<MemoAttachment[] | undefined> => {
    if (attachmentFiles.length === 0) return undefined;
    const formData = new FormData();
    formData.append("memoId", memoId);
    for (const file of attachmentFiles) formData.append("files", file);

    const response = await fetch("/api/attachments", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Unable to upload attachments" }));
      throw new Error(String(body.error ?? "Unable to upload attachments"));
    }
    const body = await response.json() as { attachments: MemoAttachment[] };
    return body.attachments.length > 0 ? body.attachments : undefined;
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    if (status === "draft" && isRevisionMode) return; // Save Draft is not available in revision mode
    if (isSubmitting) return;

    // 🔴 VALIDATION: Only validate mandatory fields when sending to approval (pending status)
    if (status === "pending") {
      if (!canSubmitPending) return;

      const validation = validateMemoFormForApproval({
        subject,
        description,
        requestItems,
        priceComparisons,
      });

      if (!validation.valid) {
        validation.errors.forEach((error) => {
          showErrorToast(error, 5000);
        });
        setIsSubmitting(false);
        return;
      }
    }

    const now = new Date();
    const stamp = formatTimestamp(now);
    setIsSubmitting(true);
    setAttachmentError(null);

    if (isRevisionMode) {
      // Dispatch SUBMIT_REVISION — applies new content to the existing memo and increments revision.
      dispatch({
        type: "SUBMIT_REVISION",
        id: reviseMemo!.id,
        title: subject,
        category,
        itemSubcategoryId,
        itemSubcategoryLabel,
        department,
        amount,
        description: description.trim() || undefined,
        closingRemark: closingRemark.trim() || undefined,
        budgetStatus,
        accountCode: accountCode.trim() || undefined,
        budgetPlan,
        budgetUsed,
        requestItems: requestItems.filter(r => r.name.trim() || r.unitPrice > 0),
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        priceAdjustmentReason: effectiveIsPriceAdjustment && priceAdjustmentReason.trim() ? priceAdjustmentReason.trim() : undefined,
        isPriceAdjustment: effectiveIsPriceAdjustment || undefined,
        followsProductionPlan: effectiveFollowsProductionPlan || undefined,
        isDeadStockOrSlowMovement: effectiveIsDeadStock || undefined,
        departmentMonthlyOverBudgetTotal: showDeptMonthly && deptMonthlyOverBudgetTotal > 0 ? deptMonthlyOverBudgetTotal : undefined,
        readRecipients: orderedReadRecipients,
        readActions: orderedReadRecipients.length > 0
          ? orderedReadRecipients.map((r): ReadAction => ({ recipient: r, status: "pending" }))
          : undefined,
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        notifyMD: recommendation.notifyMD,
        requiresMdReview: recommendation.requiresMdReview,
        updatedAt: stamp,
      });
      router.push("/queue");
      return;
    }

    // Normal new-memo path
    const id = generateMemoId(now);
    const createdTimestamp = formatTimestamp(now);
    let attachments: MemoAttachment[] | undefined;
    try {
      attachments = await uploadSelectedAttachments(id);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to upload attachments");
      setIsSubmitting(false);
      return;
    }
    dispatch({
      type: "ADD_MEMO",
      memo: {
        id, title: subject, requester: user.name, department, category, amount, status,
        itemSubcategoryId,
        itemSubcategoryLabel,
        currentStep: firstCheckingStep,
        workflowState: "Issued",
        recommendedFinalApprover: recommendation.recommendedFinalApprover,
        recommendedRoute: routeReview.recommendedRoute,
        selectedRoute,
        routeMode: routeReview.mode,
        routeOverrideReason: routeReview.requiresReason ? cleanOverrideReason : undefined,
        readRecipients: orderedReadRecipients,
        readActions: status === "pending" && orderedReadRecipients.length > 0
          ? orderedReadRecipients.map((r): ReadAction => ({ recipient: r, status: "pending" }))
          : undefined,
        description: description.trim() || undefined,
        closingRemark: closingRemark.trim() || undefined,
        budgetStatus,
        accountCode: accountCode.trim() || undefined,
        budgetPlan,
        budgetUsed,
        notifyMD: recommendation.notifyMD,
        requiresMdReview: recommendation.requiresMdReview,
        priceComparisons,
        selectedVendorId: selectedVendor?.id,
        selectedVendorReason: selectedNotLowest ? cleanVendorReason : undefined,
        requestItems: requestItems.filter(r => r.name.trim() || r.unitPrice > 0),
        attachments,
        priceAdjustmentReason: effectiveIsPriceAdjustment && priceAdjustmentReason.trim() ? priceAdjustmentReason.trim() : undefined,
        isPriceAdjustment: effectiveIsPriceAdjustment || undefined,
        followsProductionPlan: effectiveFollowsProductionPlan || undefined,
        isDeadStockOrSlowMovement: effectiveIsDeadStock || undefined,
        departmentMonthlyOverBudgetTotal: showDeptMonthly && deptMonthlyOverBudgetTotal > 0 ? deptMonthlyOverBudgetTotal : undefined,
        cycleHours: 0, createdAt: createdTimestamp, updatedAt: createdTimestamp,
      },
    });
    router.push(status === "pending" ? "/queue" : "/");
  };

  return {
    attachmentFiles, attachmentError, isSubmitting,
    addAttachmentFiles, removeAttachmentFile, handleSubmit,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- useMemoSubmit`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/create/_hooks/useMemoSubmit.ts src/app/create/_hooks/useMemoSubmit.test.ts
git commit -m "refactor(create): extract useMemoSubmit hook"
```

---

### Task 5: Rewire `page.tsx` to compose the 5 hooks

**Files:**
- Modify: `src/app/create/page.tsx` (entire `CreatePageContent` body — state/handler declarations only; JSX markup is unchanged)

**Interfaces:**
- Consumes: `useMemoFormFields` (Task 1), `useMemoTemplates` (Task 2), `useMemoAiAssist` (Task 3), `useMemoSubmit` (Task 4), `useCreateMemoAssistant` (existing, untouched).
- Produces: nothing new — `page.tsx` remains the default export consumed by the Next.js router.

- [ ] **Step 1: Replace the top of `CreatePageContent` (imports + state block) with hook composition**

In `src/app/create/page.tsx`, replace lines 1–742 (everything from the top of the file through the end of `handleSubmit`, i.e. everything before the `return (` that starts the JSX) with:

```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useMemos } from "@/lib/memo-store";
import {
  IconChevRight, IconFileText, IconMail, IconRoute, IconSparkles, IconBookmark
} from "@/components/icons";
import { StepDot } from "./_components/StepDot";
import { AttachmentsCard } from "./_components/AttachmentsCard";
import { ClosingRemarkCard } from "./_components/ClosingRemarkCard";
import { RequestItemsCard } from "./_components/RequestItemsCard";
import { BudgetCard } from "./_components/BudgetCard";
import { DraftPreviewPanel } from "./_components/DraftPreviewPanel";
import { DescriptionCard } from "./_components/DescriptionCard";
import { MemoDetailsCard } from "./_components/MemoDetailsCard";
import { RoutingCard } from "./_components/RoutingCard";
import { PriceComparisonCard } from "./_components/PriceComparisonCard";
import { useCreateMemoAssistant } from "./_hooks/useCreateMemoAssistant";
import { useMemoFormFields } from "./_hooks/useMemoFormFields";
import { useMemoTemplates } from "./_hooks/useMemoTemplates";
import { useMemoAiAssist } from "./_hooks/useMemoAiAssist";
import { useMemoSubmit } from "./_hooks/useMemoSubmit";
import { usePrototypeUser } from "@/lib/prototype-user-context";
import { ReadRecipientPicker } from "./_components/ReadRecipientPicker";
import { SaveTemplateModal } from "./_components/SaveTemplateModal";
import { TemplateSelectorCard } from "./_components/TemplateSelectorCard";

const ASSISTANT_TABS_ID = "create-assistant-tabs";
const ASSISTANT_PANEL_ID = "create-assistant-tabpanel";

function CreatePageContent() {
  const searchParams = useSearchParams();
  const reviseId = searchParams.get("revise") ?? null;
  const { memos, dispatch } = useMemos();
  const { user } = usePrototypeUser();
  const router = useRouter();

  const formFields = useMemoFormFields({ memos, reviseId, user });
  const {
    issuer, reviseMemo, isRevisionMode,
    subject, setSubject,
    category, setCategory, itemSubcategoryId, setItemSubcategoryId,
    itemSubcategories, itemSubcategoriesError,
    department, setDepartment,
    amount, setAmount,
    budgetStatus, setBudgetStatus,
    description, setDescription,
    closingRemark, setClosingRemark,
    isPriceAdjustment, setIsPriceAdjustment,
    followsProductionPlan, setFollowsProductionPlan,
    isDeadStockOrSlowMovement, setIsDeadStockOrSlowMovement,
    deptMonthlyOverBudgetTotal, setDeptMonthlyOverBudgetTotal,
    readRecipients, setReadRecipients,
    accountCode, setAccountCode,
    budgetPlan, setBudgetPlan,
    budgetUsed, setBudgetUsed,
    priceComparisons, selectedVendorReason, setSelectedVendorReason,
    requestItems,
    priceAdjustmentReason, setPriceAdjustmentReason,
    setChosenApprover,
    skipGmStep, setSkipGmStep,
    routeOverrideReason, setRouteOverrideReason,
    clockDateLabel, clockTimeLabel, currentDateLabel,
    supportsPriceAdjustment, supportsProductionPlan, supportsDeadStock, showDeptMonthly,
    effectiveIsPriceAdjustment, effectiveIsDeadStock,
    recommendation,
    effectiveApprover,
    selectedRoute,
    routeReview,
    tierClass,
    isOverridden,
    budgetRemaining,
    cleanOverrideReason,
    orderedReadRecipients,
    selectedVendor,
    hasPricedVendor,
    lowestNetPrice,
    lowestOfferSummary,
    selectedVendorSummary,
    selectedNotLowest,
    selectedVendorVat,
    selectedVendorVatAmount,
    canSubmitPending,
    requestItemsGrandTotal,
    addRequestItem, removeRequestItem, updateRequestItem,
    addVendorRow, removeVendorRow, updateVendorRow, handleSelectVendor,
    applyBulkData, snapshotFormData,
  } = formFields;

  const {
    templates, templatesLoading, saveModalOpen, setSaveModalOpen, isSavingTemplate,
    handleLoadTemplate, handleSaveTemplate, handleDeleteTemplate,
  } = useMemoTemplates({ isRevisionMode, applyBulkData, snapshotFormData });

  const {
    isAiLoading, aiError, setAiError,
    isPdfLoading, pdfError, setPdfError,
    pdfInputRef,
    handleAiSuggest, handlePdfUpload,
  } = useMemoAiAssist({
    category, amount, department, budgetStatus, priceComparisons, requestItems, applyBulkData,
  });

  const {
    attachmentFiles, attachmentError, isSubmitting,
    addAttachmentFiles, removeAttachmentFile, handleSubmit,
  } = useMemoSubmit(formFields, { user, dispatch, router });

  const { assistantExpanded, assistantTab, assistantHydrated, setAssistantExpanded, setAssistantTab } =
    useCreateMemoAssistant();

```

- [ ] **Step 2: Update the JSX that referenced removed local names**

Two call sites in the unchanged JSX below reference names that no longer exist as locals:

1. `RoutingCard`'s `flow={flow}` prop (around the original line 1009) — change to `flow={selectedRoute}`.
2. Everything else in the JSX (from `return (` at the original line 744 through the end of the file) is copied through **unmodified** — every prop name (`subject`, `category`, `itemSubcategoryId`, `itemSubcategories`, `itemSubcategoriesError`, `department`, `amount`, `budgetStatus`, `clockTimeLabel`, `clockDateLabel`, `issuer`, `isAiLoading`, `followsProductionPlan`, `isDeadStockOrSlowMovement`, `isPriceAdjustment`, `priceAdjustmentReason`, `deptMonthlyOverBudgetTotal`, `supportsPriceAdjustment`, `supportsProductionPlan`, `supportsDeadStock`, `showDeptMonthly`, `effectiveIsPriceAdjustment`, `description`, `aiError`, `isPdfLoading`, `pdfError`, `pdfInputRef`, `templates`, `templatesLoading`, `handleLoadTemplate`, `handleDeleteTemplate`, `isRevisionMode`, `reviseMemo`, `saveModalOpen`, `isSavingTemplate`, `handleSaveTemplate`, `canSubmitPending`, `isSubmitting`, `handleSubmit`, `assistantExpanded`, `assistantTab`, `assistantHydrated`, `setAssistantExpanded`, `setAssistantTab`, `effectiveApprover`, `tierClass`, `isOverridden`, `effectiveIsDeadStock`, `skipGmStep`, `routeOverrideReason`, `routeReview`, `recommendation`, `readRecipients`, `selectedRoute`, `orderedReadRecipients`, `currentDateLabel`, `requestItems`, `requestItemsGrandTotal`, `cleanOverrideReason`, `closingRemark`, `accountCode`, `budgetPlan`, `budgetUsed`, `budgetRemaining`, `attachmentFiles`, `attachmentError`, `priceComparisons`, `selectedVendor`, `selectedVendorReason`, `lowestNetPrice`, `hasPricedVendor`, `selectedNotLowest`, `selectedVendorVat`, `selectedVendorVatAmount`, `lowestOfferSummary`, `selectedVendorSummary`, `addVendorRow`, `removeVendorRow`, `updateVendorRow`, `handleSelectVendor`) is now supplied by one of the four new hooks or the existing `useCreateMemoAssistant`, all destructured above with identical names — so no other JSX line changes.

The `CreatePageWithParams` and `CreatePage` wrapper functions at the bottom of the file (original lines 1180–1209) are untouched.

- [ ] **Step 3: Run the full verification suite**

Run: `npm.cmd test`
Expected: all suites PASS, including the 4 new hook test files and every pre-existing `lib/*.test.ts`.

Run: `npm.cmd run lint`
Expected: no errors (the removed unused imports in `page.tsx` must not leave lint warnings — double-check no leftover `import` lines reference the types/functions that moved into the hooks, e.g. `ApprovalCategory`, `computePriceRowTotals`, `newClientRowId`, `formatTimestamp`, `generateMemoId`, `validateMemoFormForApproval`, `canResubmitMemo`, `isAllowedAttachmentFile`, `MAX_ATTACHMENT_BYTES`, `coerceNonNegativeNumber`, `coercePositiveInteger`, `MemoAttachment`, `PriceComparison`, `ReadAction`, `RequestItem`, `ItemSubcategory`, `MemoTemplate`, `showErrorToast`, `showSuccessToast` — none of these should still be imported directly in `page.tsx`).

Run: `npm.cmd run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/create/page.tsx
git commit -m "refactor(create): compose page.tsx from the 4 extracted hooks"
```

---

### Task 6: Manual smoke test + close out the audit backlog item

**Files:**
- Modify: `D:\Hrproject\CLAUDE.md` (flip the P1 audit table row)

No new test/interface — this task is verification-only plus a documentation update in the sibling repo-root file (not part of the `sandbox` git repo's own history).

- [ ] **Step 1: Start the dev server and smoke-test all 6 flows**

Run: `npm.cmd run dev` (from `sandbox/`), then in a browser:

1. **New memo → submit**: go to `/create`, fill subject/department/amount/description/at least one request item and one priced vendor row, click "Send to Approval". Confirm redirect to `/queue` and the new memo appears.
2. **Template load/save/delete**: on `/create`, fill a few fields, click "Save Template", name it, confirm it appears in the `TemplateSelectorCard`. Reload `/create`, click the saved template, confirm fields repopulate. Delete it via the × icon, confirm it disappears.
3. **AI draft suggest**: click the AI sparkle button in `MemoDetailsCard` (requires `THAILLM_API_KEY` configured; if not configured, confirm the "ยังไม่ได้ตั้งค่า THAILLM_API_KEY" error renders instead of a crash).
4. **PDF extract prefill**: use the PDF upload button next to Description, upload a sample vendor-quote PDF, confirm vendor row and request items prefill.
5. **Attach file → submit**: attach a file in `AttachmentsCard`, submit, confirm the attachment appears on the created memo in `/queue`.
6. **`/create?revise=<id>` → resubmit**: from `/queue`, open a `returned` memo, click "แก้ไขและส่งใหม่", confirm the form prefills from the existing memo, edit something, submit, confirm it returns to `/queue` with an incremented revision number.

If any flow regresses, stop and fix before proceeding — do not close out the task with a known regression.

- [ ] **Step 2: Update the clean-code audit table**

In `D:\Hrproject\CLAUDE.md`, find the row (currently around line 139):

```
| P1 | `src/app/create/page.tsx` | Main create/revision page is ~1028 lines and combines form state, route analysis, AI draft, PDF extraction, attachment upload, submit, and revision handling. | Refactor behavior-preservingly into `useCreateMemoForm` plus small helpers. Avoid `useEffect` state resets; derive effective values in render. |
```

Replace with:

```
| ~~P1~~ ✅ done <YYYY-MM-DD> | `src/app/create/page.tsx` | ~~Main create/revision page is ~1028 lines and combines form state, route analysis, AI draft, PDF extraction, attachment upload, submit, and revision handling.~~ | Addressed: split into `useMemoFormFields`/`useMemoTemplates`/`useMemoAiAssist`/`useMemoSubmit` under `src/app/create/_hooks/`, each with unit tests; `page.tsx` is now a thin composition. |
```

(fill in the actual completion date). Also update the `| app/create/page.tsx | Main form. Next split candidate: \`useCreateMemoForm\` hook. |` row in the Code Organization table (around line 109) and the `**Pending refactor:**` line (around line 129) to reflect that the split is done and point at the four new hook files instead.

- [ ] **Step 3: Commit the CLAUDE.md update**

This file lives outside the `sandbox` git repo (`D:\Hrproject\CLAUDE.md` is gitignored per `[[project_root_docs_untracked]]`) — no commit needed, just save the edit.
