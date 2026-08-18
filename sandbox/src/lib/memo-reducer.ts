import {
  MemoRecord, MemoStatus, ApprovalLevel, ApprovalStepKey, ApprovalCategory, BudgetStatus,
  ApprovalRouteMode, PriceComparison, RequestItem, ReadAction,
  MemoRevision, MemoSnapshot, RevisionSource,
} from "./approval";
import type { CustomApprover } from "./custom-route";
// Pure rules module (no DB imports) — safe to pull into this client component.
import { mdReviewGateStep } from "./workflow-rules";

export type MemoAction =
  | { type: "HYDRATE_MEMOS"; memos: MemoRecord[] }
  | { type: "ADD_MEMO"; memo: MemoRecord }
  | { type: "UPDATE_STATUS"; id: string; status: MemoStatus; updatedAt?: string }
  | { type: "UPDATE_STEP"; id: string; step: ApprovalStepKey; updatedAt?: string }
  | { type: "ADVANCE_STEP"; id: string; updatedAt?: string }
  | { type: "MARK_READ"; id: string; recipient: string; actedAt?: string }
  | { type: "SKIP_ALL_READS"; id: string; skipReason: string; actedAt?: string }
  | { type: "RETURN_MEMO"; id: string; returnReason: string; returnToStep?: string; updatedAt?: string }
  | {
      type: "REVIEW_MEMO";
      id: string;
      response: "acknowledged_no_objection" | "comment" | "request_revision" | "escalate_to_md_approval";
      comment?: string;
      reason?: string;
      updatedAt?: string;
    }
  | { type: "RESUBMIT_MEMO"; id: string; revisionNote?: string; updatedAt?: string }
  | { type: "REJECT_MEMO"; id: string; disposition: "close" | "revision-allowed"; reason: string; updatedAt?: string }
  | {
      type: "SUBMIT_REVISION";
      id: string;
      title: string;
      category: ApprovalCategory;
      itemSubcategoryId?: number;
      itemSubcategoryLabel?: string;
      department: string;
      amount: number;
      description?: string;
      closingRemark?: string;
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
      recommendedRoute?: ApprovalStepKey[];
      selectedRoute?: ApprovalStepKey[];
      /** Per-person route for this revision. Authoritative like selectedRoute:
       *  undefined means "this revision uses a Book1 level route", which is how a
       *  memo switches back out of custom mode. */
      customRoute?: CustomApprover[];
      routeMode?: ApprovalRouteMode;
      routeOverrideReason?: string;
      notifyMD?: boolean;
      requiresMdReview?: boolean;
      revisionNote?: string;
      updatedAt?: string;
    }
  | { type: "DELETE_MEMO"; id: string; deletedAt: string }
  | { type: "RESTORE_MEMO"; id: string; updatedAt: string }
  | { type: "DESTROY_MEMO"; id: string };

// Content-only snapshot of a memo — used by revision archiving and DB persistence.
// Includes submitted content and routing fields only. Excludes all workflow execution
// fields (status, currentStep, workflowState, returnReason, rejectReason, etc.) so the
// snapshot stays a faithful record of what was submitted, not how it was processed.
export function buildMemoSnapshot(m: MemoRecord): MemoSnapshot {
  return {
    title: m.title,
    category: m.category,
    itemSubcategoryId: m.itemSubcategoryId,
    itemSubcategoryLabel: m.itemSubcategoryLabel,
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
    // The per-person name snapshot is part of "what was submitted": without it an
    // archived revision's token route could never be read back as people.
    customRoute: m.customRoute,
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

export function memoReducer(state: MemoRecord[], action: MemoAction): MemoRecord[] {
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

        // Gate step = "Manager / Top Section" on a level route, the first person picked
        // on a custom one. Must match the server (mdReviewGateStep) or the optimistic
        // update advances the memo while the DB parks it at MD Review.
        const needsReviewStash =
          m.currentStep === mdReviewGateStep(route ?? null) &&
          m.requiresMdReview === true &&
          m.mdReviewStatus == null;
        if (needsReviewStash) {
          const resumeStep: ApprovalStepKey = isLastOrMissing ? "Managing Director" : route![idx + 1];
          return {
            ...m,
            currentStep: "Managing Director",
            workflowState: "Checked",
            mdReviewStatus: "pending",
            mdReviewResumeStep: resumeStep,
            updatedAt: action.updatedAt ?? m.updatedAt,
          };
        }

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
    case "REVIEW_MEMO": {
      return state.map((m) => {
        if (m.id !== action.id || m.mdReviewStatus !== "pending") return m;
        const updatedAt = action.updatedAt ?? m.updatedAt;

        if (action.response === "request_revision") {
          return {
            ...m,
            status: "returned" as const,
            returnReason: action.reason,
            mdReviewStatus: "completed" as const,
            updatedAt,
          };
        }
        if (action.response === "escalate_to_md_approval") {
          return {
            ...m,
            status: "approved" as const,
            workflowState: "Approved" as const,
            currentStep: "Managing Director" as const,
            mdReviewStatus: "escalated" as const,
            mdReviewComment: action.comment,
            updatedAt,
          };
        }
        const resumeStep = m.mdReviewResumeStep ?? "Managing Director";
        const comment = action.response === "comment" ? action.comment : undefined;
        if (resumeStep === "Managing Director") {
          return {
            ...m,
            status: "approved" as const,
            workflowState: "Approved" as const,
            currentStep: "Managing Director" as const,
            mdReviewStatus: "completed" as const,
            mdReviewComment: comment,
            updatedAt,
          };
        }
        return {
          ...m,
          status: "pending" as const,
          workflowState: "Checked" as const,
          currentStep: resumeStep,
          mdReviewStatus: "completed" as const,
          mdReviewComment: comment,
          updatedAt,
        };
      });
    }
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
          mdReviewStatus: undefined,
          mdReviewResumeStep: undefined,
          mdReviewComment: undefined,
          mdReviewActedBy: undefined,
          mdReviewActedAt: undefined,
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
          itemSubcategoryId: action.itemSubcategoryId,
          itemSubcategoryLabel: action.itemSubcategoryLabel,
          department: action.department,
          amount: action.amount,
          description: action.description,
          closingRemark: action.closingRemark,
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
          // Not `?? m.customRoute`: a revision that switches back to a Book1 route
          // must clear the old per-person snapshot, not inherit it.
          customRoute: action.customRoute,
          routeMode: action.routeMode,
          routeOverrideReason: action.routeOverrideReason,
          notifyMD: action.notifyMD,
          requiresMdReview: action.requiresMdReview,
          // Workflow reset (same as RESUBMIT_MEMO):
          status: "pending" as const,
          // Falling back to the memo's own first step (not straight to Manager)
          // matters for a custom route: "Manager / Top Section" would hand the
          // memo to a department manager the requester never chose.
          currentStep: action.selectedRoute?.[0] ?? m.selectedRoute?.[0] ?? "Manager / Top Section",
          workflowState: "Issued" as const,
          revisionNo: currentRevNo + 1,
          revisions: [...(m.revisions ?? []), newRevision],
          revisionNote: action.revisionNote,
          updatedAt: action.updatedAt ?? m.updatedAt,
          returnReason: undefined,
          rejectReason: undefined,
          rejectDisposition: undefined,
          mdReviewStatus: undefined,
          mdReviewResumeStep: undefined,
          mdReviewComment: undefined,
          mdReviewActedBy: undefined,
          mdReviewActedAt: undefined,
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
    case "DELETE_MEMO":
      // Soft-delete: mark voided but keep the row so it can be restored and its audit trail survives.
      return state.map((m) =>
        m.id === action.id ? { ...m, deletedAt: action.deletedAt, updatedAt: action.deletedAt } : m
      );
    case "RESTORE_MEMO":
      return state.map((m) =>
        m.id === action.id ? { ...m, deletedAt: undefined, updatedAt: action.updatedAt } : m
      );
    case "DESTROY_MEMO":
      return state.filter((m) => m.id !== action.id);
    default:
      return state;
  }
}
