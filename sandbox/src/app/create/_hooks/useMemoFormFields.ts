"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analyzeApprovalRoute,
  ApprovalCategory,
  ApprovalLevel,
  buildApprovalFlow,
  BudgetStatus,
  computePriceRowTotals,
  discountAmountFromPercent,
  getApprovalRecommendation,
  MemoRecord,
  needsNonNegotiableRemark,
  NON_NEGOTIABLE_REMARK,
  PriceComparison,
  requiresOverrideReasonForCustomRoute,
  RequestItem,
} from "@/lib/approval";
import { coerceNonNegativeNumber, coercePositiveInteger } from "@/lib/number-input";
import { newClientRowId } from "@/lib/client-row-id";
import { canResubmitMemo, prototypeUserAuthId, PrototypeUser } from "@/lib/prototype-users";
import type { ItemSubcategory } from "@/lib/item-subcategories";
import type { MemoBodyBlock, MemoFormMode } from "@/lib/memo-body-blocks";
import { useCustomRoute } from "./useCustomRoute";
import { useBodyBlocks } from "./useBodyBlocks";

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

  // ── Notification short note (V2 §3, Q13/Q14) ──
  // Deliberately NOT wired into applyBulkData/snapshotFormData below. This belongs to
  // *this one submission's notification*, not to the memo's reusable content: saving it
  // into a template, or letting a loaded template / AI draft / PDF prefill silently
  // overwrite it, would both be wrong. Do not "fix" this omission — it is intentional.
  // Also not part of revision-mode prefill: a resubmit does not send a new note
  // notification (Q16), so there is nothing meaningful to carry forward.
  const [notifyNote, setNotifyNote] = useState("");
  const [notifyNoteImageFiles, setNotifyNoteImageFiles] = useState<File[]>([]);
  const [notifyAttachExcel, setNotifyAttachExcel] = useState(false);

  // ── Routing fields — always default to fresh recommendation (user decision) ──
  // The per-person route is the exception: a revision reopens on whichever tab the
  // memo was submitted from, with the same people, so resubmitting does not
  // silently swap the approvers the requester originally chose.
  const revisionCustomPeople =
    isRevisionMode && (reviseMemo!.customRoute?.length ?? 0) > 0
      ? reviseMemo!.customRoute!.map((a) => ({
          userId: a.userId,
          name: a.name,
          approvalLevel: a.approvalLevel,
          department: a.department,
        }))
      : undefined;
  const customRoute = useCustomRoute({
    initialPeople: revisionCustomPeople,
    initialSource: revisionCustomPeople ? "custom" : "book1",
    // Only a real auth-backed user has a users.id; mock prototype users get null,
    // which simply disables the self-pick warning.
    currentUserId: prototypeUserAuthId(user),
  });

  // V3 free-form body — same revision-seeding pattern as customRoute above.
  const bodyBlocks = useBodyBlocks(
    isRevisionMode
      ? { formMode: reviseMemo!.formMode ?? "standard", blocks: reviseMemo!.bodyBlocks ?? [] }
      : undefined
  );
  const isFreeform = bodyBlocks.formMode === "freeform";

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
  const rowsMissingNonNegotiableRemark = priceComparisons.filter(
    row => needsNonNegotiableRemark(row) && (row.remark ?? "").trim().length === 0
  );
  // Task 10 fix round 1, F1: standard-mode custom routing (V2) still waives the
  // Book1 override reason entirely — routeReview there compares the Book1 ladder,
  // which is not the route being used at all, and the server writes its own audit
  // reason when it rebuilds the per-person route. That V2 decision is unchanged.
  // Free-form is different: the spec requires the reason whenever the custom
  // route's actual final approver ranks below the Book1 recommendation, precisely
  // so free-form cannot become a way around the amount rules (Ruling 14).
  const freeformCustomRouteRequiresReason =
    isFreeform && customRoute.routeSource === "custom"
      ? requiresOverrideReasonForCustomRoute(recommendation.recommendedFinalApprover, customRoute.people)
      : false;
  // Task 10 fix round 2, G1: the reason field this gate demands lives inside
  // the collapsible assistant panel (CustomRouteReasonNote, on the "Approver
  // Routing" tab) — whose collapsed state and active tab both persist across
  // sessions via localStorage. A requester whose panel is collapsed, or on a
  // different tab, would otherwise hit a disabled submit button with no
  // visible reason why. This drives a warning FormModeToggle renders outside
  // the panel, next to the mode switch itself — the same place F2's "pick an
  // approver" warning already lives, per that ruling's own principle that a
  // blocking requirement must not live only inside the collapsible panel.
  const freeformRouteReasonMissing = freeformCustomRouteRequiresReason && cleanOverrideReason.length === 0;
  const canSubmitPending =
    (customRoute.routeSource === "custom"
      ? (!freeformCustomRouteRequiresReason || cleanOverrideReason.length > 0)
      : (!routeReview.requiresReason || cleanOverrideReason.length > 0)) &&
    (!selectedNotLowest || cleanVendorReason.length > 0) &&
    rowsMissingNonNegotiableRemark.length === 0 &&
    customRoute.canSubmitCustom &&
    // Task 10 fix round 2, G2: customRoute.canSubmitCustom is vacuously true
    // whenever routeSource !== "custom" — but applyBulkData (a loaded template
    // saved from free-form) can set formMode: "freeform" without touching
    // routeSource/people, landing on formMode "freeform" + routeSource "book1"
    // + zero people. That combination must never be submittable regardless of
    // which branch produced it, so this checks the invariant directly instead
    // of trusting routeSource to already be "custom" here.
    (!isFreeform || customRoute.people.length > 0);
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
  const updateVendorDiscountPercent = (id: string, percent: number) => {
    const row = priceComparisons.find(r => r.id === id);
    if (!row) return;
    updateVendorRow(id, { discount: discountAmountFromPercent(row.offeredPrice, percent) });
  };
  const markVendorNonNegotiable = (id: string) => {
    updateVendorRow(id, { remark: NON_NEGOTIABLE_REMARK });
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
    if (data.formMode) {
      bodyBlocks.setFormMode(data.formMode as MemoFormMode);
      // Task 10 fix round 2, G2: a template saved from free-form mode carries
      // formMode: "freeform" (snapshotFormData below) but never carried
      // routeSource/customRoute people — this hook has never persisted the
      // approver list into a template. Applying that data without also
      // forcing routeSource here would land on formMode "freeform" +
      // routeSource "book1" + zero custom-route people, which is exactly the
      // 400-then-data-loss combination C2/F2 were written to prevent. This
      // keeps the same invariant handleFormModeChange (page.tsx) enforces on
      // a manual toggle click true for this load path too.
      if (data.formMode === "freeform") customRoute.setRouteSource("custom");
    }
    if (Array.isArray(data.bodyBlocks)) bodyBlocks.setBlocks(data.bodyBlocks as MemoBodyBlock[]);
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
    formMode: bodyBlocks.formMode,
    bodyBlocks: bodyBlocks.blocks,
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
    notifyNote, setNotifyNote,
    notifyNoteImageFiles, setNotifyNoteImageFiles,
    notifyAttachExcel, setNotifyAttachExcel,
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
    bodyBlocks,
    isFreeform,
    freeformCustomRouteRequiresReason,
    freeformRouteReasonMissing,
    customRoute,
    routeSource: customRoute.routeSource,
    customRoutePeople: customRoute.people,
    rowsMissingNonNegotiableRemark,
    updateVendorDiscountPercent, markVendorNonNegotiable,
    requestItemsGrandTotal,
    addRequestItem, removeRequestItem, updateRequestItem,
    addVendorRow, removeVendorRow, updateVendorRow, handleSelectVendor,
    applyBulkData, snapshotFormData,
  };
}

export type MemoFormFieldsResult = ReturnType<typeof useMemoFormFields>;
