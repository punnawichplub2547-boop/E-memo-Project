"use client";

import React, { createContext, useCallback, useContext, useEffect, useReducer, useState } from "react";
import {
  seedMemos, MemoRecord, MemoStatus, ApprovalLevel, ApprovalCategory, BudgetStatus,
  ApprovalRouteMode, PriceComparison, RequestItem, ReadAction,
  MemoRevision, MemoSnapshot, RevisionSource,
} from "./approval";
import { memoToDbSeedRow } from "./db-seed";
import { PROTOTYPE_ACTOR_NAME } from "./prototype-user";
import type {
  AdvanceStepBody,
  MarkReadBody,
  RejectMemoBody,
  ResubmitMemoBody,
  ReturnMemoBody,
  SkipAllReadsBody,
  SubmitRevisionBody,
} from "./db-memo-write";

type Action =
  | { type: "HYDRATE_MEMOS"; memos: MemoRecord[] }
  | { type: "ADD_MEMO"; memo: MemoRecord }
  | { type: "UPDATE_STATUS"; id: string; status: MemoStatus; updatedAt?: string }
  | { type: "UPDATE_STEP"; id: string; step: ApprovalLevel; updatedAt?: string }
  | { type: "ADVANCE_STEP"; id: string; updatedAt?: string }
  | { type: "MARK_READ"; id: string; recipient: string; actedAt?: string }
  | { type: "SKIP_ALL_READS"; id: string; skipReason: string; actedAt?: string }
  | { type: "RETURN_MEMO"; id: string; returnReason: string; updatedAt?: string }
  | { type: "RESUBMIT_MEMO"; id: string; revisionNote?: string; updatedAt?: string }
  | { type: "REJECT_MEMO"; id: string; disposition: "close" | "revision-allowed"; reason: string; updatedAt?: string }
  | {
      type: "SUBMIT_REVISION";
      id: string;
      title: string;
      category: ApprovalCategory;
      department: string;
      amount: number;
      description?: string;
      budgetStatus?: BudgetStatus;
      accountCode?: string;
      budgetPlan?: number;
      budgetUsed?: number;
      requestItems?: RequestItem[];
      priceComparisons?: PriceComparison[];
      selectedVendorId?: string;
      selectedVendorReason?: string;
      priceAdjustmentReason?: string;
      isPriceAdjustment?: boolean;
      followsProductionPlan?: boolean;
      isDeadStockOrSlowMovement?: boolean;
      departmentMonthlyOverBudgetTotal?: number;
      readRecipients?: string[];
      readActions?: ReadAction[];
      recommendedFinalApprover?: ApprovalLevel;
      recommendedRoute?: ApprovalLevel[];
      selectedRoute?: ApprovalLevel[];
      routeMode?: ApprovalRouteMode;
      routeOverrideReason?: string;
      notifyMD?: boolean;
      revisionNote?: string;
      updatedAt?: string;
    };

// Content-only snapshot of a memo — used by revision archiving and DB persistence.
// Includes submitted content and routing fields only. Excludes all workflow execution
// fields (status, currentStep, workflowState, returnReason, rejectReason, etc.) so the
// snapshot stays a faithful record of what was submitted, not how it was processed.
export function buildMemoSnapshot(m: MemoRecord): MemoSnapshot {
  return {
    title: m.title,
    category: m.category,
    department: m.department,
    amount: m.amount,
    description: m.description,
    budgetStatus: m.budgetStatus,
    accountCode: m.accountCode,
    budgetPlan: m.budgetPlan,
    budgetUsed: m.budgetUsed,
    requestItems: m.requestItems,
    priceComparisons: m.priceComparisons,
    selectedVendorId: m.selectedVendorId,
    selectedVendorReason: m.selectedVendorReason,
    priceAdjustmentReason: m.priceAdjustmentReason,
    isPriceAdjustment: m.isPriceAdjustment,
    followsProductionPlan: m.followsProductionPlan,
    isDeadStockOrSlowMovement: m.isDeadStockOrSlowMovement,
    departmentMonthlyOverBudgetTotal: m.departmentMonthlyOverBudgetTotal,
    readRecipients: m.readRecipients,
    recommendedFinalApprover: m.recommendedFinalApprover,
    recommendedRoute: m.recommendedRoute,
    selectedRoute: m.selectedRoute,
    routeMode: m.routeMode,
    routeOverrideReason: m.routeOverrideReason,
    notifyMD: m.notifyMD,
  };
}

// Shared revision builder — used by both RESUBMIT_MEMO and SUBMIT_REVISION.
// Appends to revisions[]. The submittedAt fallback chain:
//   revisionSubmittedAt (set on previous resubmit) → createdAt → updatedAt
function buildMemoRevision(
  m: MemoRecord,
  source: RevisionSource,
  revisionNote: string | undefined
): { revision: MemoRevision; currentRevNo: number } {
  const currentRevNo = m.revisionNo ?? 0;
  const revision: MemoRevision = {
    revisionNo: currentRevNo,
    source,
    returnReason: m.returnReason,
    rejectReason: m.rejectReason,
    revisionNote,
    submittedAt: m.revisionSubmittedAt ?? m.createdAt ?? m.updatedAt,
    snapshot: buildMemoSnapshot(m),
  };
  return { revision, currentRevNo };
}

export function memoReducer(state: MemoRecord[], action: Action): MemoRecord[] {
  switch (action.type) {
    case "HYDRATE_MEMOS":
      return action.memos;
    case "ADD_MEMO":
      return [action.memo, ...state];
    case "UPDATE_STATUS":
      return state.map((m) =>
        m.id === action.id ? { ...m, status: action.status, updatedAt: action.updatedAt ?? m.updatedAt } : m
      );
    case "UPDATE_STEP":
      return state.map((m) =>
        m.id === action.id ? { ...m, currentStep: action.step, updatedAt: action.updatedAt ?? m.updatedAt } : m
      );
    case "ADVANCE_STEP": {
      return state.map((m) => {
        if (m.id !== action.id || m.status !== "pending") return m;
        const route = m.selectedRoute;
        const idx = route ? route.indexOf(m.currentStep) : -1;
        const isLastOrMissing = !route || route.length === 0 || idx === -1 || idx === route.length - 1;
        if (isLastOrMissing) {
          return { ...m, status: "approved", workflowState: "Approved", updatedAt: action.updatedAt ?? m.updatedAt };
        }
        return { ...m, currentStep: route[idx + 1], workflowState: "Checked", updatedAt: action.updatedAt ?? m.updatedAt };
      });
    }
    case "MARK_READ": {
      return state.map((m) => {
        if (m.id !== action.id || m.status !== "pending" || !m.readActions) return m;
        return {
          ...m,
          readActions: m.readActions.map((ra) =>
            ra.recipient === action.recipient
              ? { ...ra, status: "read" as const, actedAt: action.actedAt ?? ra.actedAt }
              : ra
          ),
        };
      });
    }
    case "SKIP_ALL_READS": {
      return state.map((m) => {
        if (m.id !== action.id || m.status !== "pending" || !m.readActions) return m;
        return {
          ...m,
          readActions: m.readActions.map((ra) =>
            ra.status === "pending"
              ? { ...ra, status: "skipped" as const, skipReason: action.skipReason, actedAt: action.actedAt ?? ra.actedAt }
              : ra
          ),
        };
      });
    }
    case "RETURN_MEMO":
      return state.map((m) =>
        m.id === action.id ? { ...m, status: "returned", returnReason: action.returnReason, updatedAt: action.updatedAt ?? m.updatedAt } : m
      );
    case "RESUBMIT_MEMO": {
      return state.map((m) => {
        if (m.id !== action.id) return m;
        const isValidResubmit =
          m.status === "returned" ||
          (m.status === "rejected" && m.rejectDisposition === "revision-allowed");
        if (!isValidResubmit) return m;
        const source: RevisionSource = m.status === "returned" ? "return" : "rejection-allowed";
        const { revision: newRevision, currentRevNo } = buildMemoRevision(m, source, action.revisionNote);
        return {
          ...m,
          status: "pending" as const,
          currentStep: m.selectedRoute?.[0] ?? "Manager / Top Section",
          workflowState: "Issued" as const,
          revisionNo: currentRevNo + 1,
          revisions: [...(m.revisions ?? []), newRevision],
          revisionNote: action.revisionNote,
          updatedAt: action.updatedAt ?? m.updatedAt,
          readActions: m.readActions?.map((ra): ReadAction => ({ recipient: ra.recipient, status: "pending" })),
          returnReason: undefined,
          rejectReason: undefined,
          rejectDisposition: undefined,
          revisionSubmittedAt: action.updatedAt ?? m.updatedAt,
        };
      });
    }
    case "SUBMIT_REVISION": {
      return state.map((m) => {
        if (m.id !== action.id) return m;
        const isValid =
          m.status === "returned" ||
          (m.status === "rejected" && m.rejectDisposition === "revision-allowed");
        if (!isValid) return m;
        const source: RevisionSource = m.status === "returned" ? "return" : "rejection-allowed";
        const { revision: newRevision, currentRevNo } = buildMemoRevision(m, source, action.revisionNote);
        return {
          ...m,
          // New content from the revision form (overwrites old content):
          title: action.title,
          category: action.category,
          department: action.department,
          amount: action.amount,
          description: action.description,
          budgetStatus: action.budgetStatus,
          accountCode: action.accountCode,
          budgetPlan: action.budgetPlan,
          budgetUsed: action.budgetUsed,
          requestItems: action.requestItems,
          priceComparisons: action.priceComparisons,
          selectedVendorId: action.selectedVendorId,
          selectedVendorReason: action.selectedVendorReason,
          priceAdjustmentReason: action.priceAdjustmentReason,
          isPriceAdjustment: action.isPriceAdjustment,
          followsProductionPlan: action.followsProductionPlan,
          isDeadStockOrSlowMovement: action.isDeadStockOrSlowMovement,
          departmentMonthlyOverBudgetTotal: action.departmentMonthlyOverBudgetTotal,
          readRecipients: action.readRecipients,
          readActions: action.readActions,
          recommendedFinalApprover: action.recommendedFinalApprover,
          recommendedRoute: action.recommendedRoute,
          selectedRoute: action.selectedRoute,
          routeMode: action.routeMode,
          routeOverrideReason: action.routeOverrideReason,
          notifyMD: action.notifyMD,
          // Workflow reset (same as RESUBMIT_MEMO):
          status: "pending" as const,
          currentStep: action.selectedRoute?.[0] ?? "Manager / Top Section",
          workflowState: "Issued" as const,
          revisionNo: currentRevNo + 1,
          revisions: [...(m.revisions ?? []), newRevision],
          revisionNote: action.revisionNote,
          updatedAt: action.updatedAt ?? m.updatedAt,
          returnReason: undefined,
          rejectReason: undefined,
          rejectDisposition: undefined,
          revisionSubmittedAt: action.updatedAt ?? m.updatedAt,
        };
      });
    }
    case "REJECT_MEMO":
      return state.map((m) =>
        m.id === action.id
          ? { ...m, status: "rejected", rejectDisposition: action.disposition, rejectReason: action.reason, updatedAt: action.updatedAt ?? m.updatedAt }
          : m
      );
    default:
      return state;
  }
}

interface MemoContextValue {
  memos: MemoRecord[];
  dispatch: React.Dispatch<Action>;
  /** True once the initial DB hydration fetch has settled (success or network failure). */
  hydrated: boolean;
}

const MemoContext = createContext<MemoContextValue | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, reducerDispatch] = useReducer(memoReducer, seedMemos);
  const [hydrated, setHydrated] = useState(false);
  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    if (action.type === "ADVANCE_STEP") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistAdvanceStep(action.id, prevMemo, nextMemo, action.updatedAt);
      }
    } else if (action.type === "RETURN_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistReturnMemo(action.id, prevMemo, nextMemo, action.returnReason, action.updatedAt);
      }
    } else if (action.type === "REJECT_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistRejectMemo(action.id, prevMemo, nextMemo, action.disposition, action.reason, action.updatedAt);
      }
    } else if (action.type === "RESUBMIT_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistResubmitMemo(action.id, prevMemo, nextMemo, action.revisionNote, action.updatedAt);
      }
    } else if (action.type === "SUBMIT_REVISION") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistSubmitRevisionMemo(action.id, prevMemo, nextMemo, action.revisionNote);
      }
    } else if (action.type === "MARK_READ") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      const nextReadAction = nextMemo?.readActions?.find((ra) => ra.recipient === action.recipient);
      if (prevMemo && nextMemo && prevMemo !== nextMemo && nextReadAction?.status === "read") {
        void persistMarkRead(action.id, nextMemo, action.recipient, action.actedAt ?? nextReadAction.actedAt ?? nextMemo.updatedAt);
      }
    } else if (action.type === "SKIP_ALL_READS") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        const skippedRecipients = prevMemo.readActions
          ?.filter((ra) => ra.status === "pending")
          .map((ra) => ra.recipient) ?? [];
        if (skippedRecipients.length === 0) return;
        const actedAt = action.actedAt ??
          nextMemo.readActions?.find((ra) => ra.status === "skipped" && skippedRecipients.includes(ra.recipient))?.actedAt ??
          nextMemo.updatedAt;
        void persistSkipAllReads(action.id, nextMemo, skippedRecipients, action.skipReason, actedAt);
      }
    } else {
      reducerDispatch(action);
      if (action.type === "ADD_MEMO") {
        void persistNewMemo(action.memo);
      }
    }
  }, [memos]);
  useEffect(() => {
    let cancelled = false;
    async function hydrateMemos() {
      try {
        const response = await fetch("/api/memos", { cache: "no-store" });
        if (!response.ok) return;
        const dbMemos = await response.json() as MemoRecord[];
        if (!cancelled && Array.isArray(dbMemos)) {
          reducerDispatch({ type: "HYDRATE_MEMOS", memos: dbMemos });
        }
      } catch {
        // Keep seedMemos as the prototype fallback when DB-1 is unavailable.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    void hydrateMemos();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <MemoContext.Provider value={{ memos, dispatch, hydrated }}>
      {children}
    </MemoContext.Provider>
  );
}

async function persistAdvanceStep(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  updatedAt?: string,
) {
  const body: AdvanceStepBody = {
    stepLabel: prev.currentStep,
    nextCurrentStep: next.currentStep,
    nextStatus: next.status,
    nextWorkflowState: next.workflowState ?? "Checked",
    revisionNo: next.revisionNo ?? 0,
    updatedAt: updatedAt ?? next.updatedAt,
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] ADVANCE_STEP persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] ADVANCE_STEP persist failed", error);
  }
}

async function persistReturnMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  returnReason: string,
  updatedAt?: string,
) {
  const body: ReturnMemoBody = {
    stepLabel: prev.currentStep,
    returnReason,
    revisionNo: next.revisionNo ?? 0,
    updatedAt: updatedAt ?? next.updatedAt,
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] RETURN_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] RETURN_MEMO persist failed", error);
  }
}

async function persistResubmitMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  revisionNote: string | undefined,
  updatedAt?: string,
) {
  const body: ResubmitMemoBody = {
    oldRevisionNo: prev.revisionNo ?? 0,
    source: prev.status === "returned" ? "return" : "rejection-allowed",
    returnReason: prev.returnReason ?? null,
    rejectReason: prev.rejectReason ?? null,
    revisionNote: revisionNote ?? null,
    oldSubmittedAt: prev.revisionSubmittedAt ?? prev.createdAt,
    snapshotJson: JSON.stringify(buildMemoSnapshot(prev)),
    nextCurrentStep: next.currentStep,
    readRecipients: prev.readActions?.map((ra) => ra.recipient) ?? [],
    updatedAt: updatedAt ?? next.updatedAt,
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/resubmit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] RESUBMIT_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] RESUBMIT_MEMO persist failed", error);
  }
}

async function persistSubmitRevisionMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  revisionNote: string | undefined,
) {
  const body: SubmitRevisionBody = {
    oldRevisionNo: prev.revisionNo ?? 0,
    source: prev.status === "returned" ? "return" : "rejection-allowed",
    returnReason: prev.returnReason ?? null,
    rejectReason: prev.rejectReason ?? null,
    revisionNote: revisionNote ?? null,
    // prev used here: old submitted-at timestamp for the revision archive entry
    oldSubmittedAt: prev.revisionSubmittedAt ?? prev.createdAt,
    // prev used here: snapshot of OLD content — must NOT use next
    snapshotJson: JSON.stringify(buildMemoSnapshot(prev)),
    // next used here: full updated live row with new form content already applied
    nextMemoRow: memoToDbSeedRow(next),
    readRecipients: next.readActions?.map((ra) => ra.recipient) ??
                    next.readRecipients ??
                    [],
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/submit-revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] SUBMIT_REVISION persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] SUBMIT_REVISION persist failed", error);
  }
}

async function persistRejectMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  disposition: "close" | "revision-allowed",
  rejectReason: string,
  updatedAt?: string,
) {
  const body: RejectMemoBody = {
    stepLabel: prev.currentStep,
    disposition,
    rejectReason,
    revisionNo: next.revisionNo ?? 0,
    updatedAt: updatedAt ?? next.updatedAt,
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] REJECT_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] REJECT_MEMO persist failed", error);
  }
}

async function persistMarkRead(
  memoId: string,
  next: MemoRecord,
  recipient: string,
  actedAt: string,
) {
  const body: MarkReadBody = {
    recipient,
    revisionNo: next.revisionNo ?? 0,
    actedAt,
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] MARK_READ persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] MARK_READ persist failed", error);
  }
}

async function persistSkipAllReads(
  memoId: string,
  next: MemoRecord,
  recipients: string[],
  skipReason: string,
  actedAt: string,
) {
  const body: SkipAllReadsBody = {
    recipients,
    skipReason,
    revisionNo: next.revisionNo ?? 0,
    actedAt,
    actorName: PROTOTYPE_ACTOR_NAME,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/skip-reads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] SKIP_ALL_READS persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] SKIP_ALL_READS persist failed", error);
  }
}

async function persistNewMemo(memo: MemoRecord) {
  try {
    const response = await fetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memo),
    });
    if (!response.ok && response.status !== 409) {
      console.error("[MemoProvider] Failed to persist memo", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] Failed to persist memo", error);
  }
}

export function useMemos() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("useMemos must be used within MemoProvider");
  return ctx;
}
