"use client";

import React, { createContext, useContext, useReducer } from "react";
import {
  seedMemos, MemoRecord, MemoStatus, ApprovalLevel, ApprovalCategory, BudgetStatus,
  ApprovalRouteMode, PriceComparison, RequestItem, ReadAction,
  MemoRevision, MemoSnapshot, RevisionSource,
} from "./approval";

type Action =
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

// Shared snapshot + revision builder — used by both RESUBMIT_MEMO and SUBMIT_REVISION.
// Captures the memo's current content as a frozen snapshot, then builds the revision record
// that will be appended to revisions[]. The submittedAt fallback chain:
//   revisionSubmittedAt (set on previous resubmit) → createdAt → updatedAt
function buildMemoRevision(
  m: MemoRecord,
  source: RevisionSource,
  revisionNote: string | undefined
): { revision: MemoRevision; currentRevNo: number } {
  const currentRevNo = m.revisionNo ?? 0;
  const snapshot: MemoSnapshot = {
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
  const revision: MemoRevision = {
    revisionNo: currentRevNo,
    source,
    returnReason: m.returnReason,
    rejectReason: m.rejectReason,
    revisionNote,
    submittedAt: m.revisionSubmittedAt ?? m.createdAt ?? m.updatedAt,
    snapshot,
  };
  return { revision, currentRevNo };
}

export function memoReducer(state: MemoRecord[], action: Action): MemoRecord[] {
  switch (action.type) {
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
}

const MemoContext = createContext<MemoContextValue | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, dispatch] = useReducer(memoReducer, seedMemos);
  return (
    <MemoContext.Provider value={{ memos, dispatch }}>
      {children}
    </MemoContext.Provider>
  );
}

export function useMemos() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("useMemos must be used within MemoProvider");
  return ctx;
}
