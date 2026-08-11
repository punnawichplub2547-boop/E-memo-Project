// Turns the /create form's state into a MemoRecord.
//
// This assembly used to live inline in useMemoSubmit.handleSubmit, which meant
// the only way to get a record out of the form was to submit it. The Excel
// preview needs the same record without submitting, and the two must agree
// field for field — a preview that shows something the submit does not send is
// worse than no preview. So it lives here, as a pure function both call.
//
// The SUBMIT_REVISION path is deliberately NOT routed through this: it
// dispatches a different payload shape (an edit applied to an existing memo,
// not a whole new record). Preview in revision mode still uses this function,
// passing the existing memo's id.
import type {
  ApprovalCategory,
  ApprovalLevel,
  ApprovalRouteMode,
  BudgetStatus,
  MemoAttachment,
  MemoRecord,
  MemoStatus,
  PriceComparison,
  ReadAction,
  RequestItem,
} from "./approval";
import { buildCustomRoute } from "./custom-route";

/** The slice of the create form this needs. `MemoFormFieldsResult` satisfies it
 *  structurally, so the hook can be passed straight in. */
export type MemoDraftFields = {
  subject: string;
  category: ApprovalCategory;
  itemSubcategoryId?: number;
  itemSubcategoryLabel?: string;
  department: string;
  amount: number;
  description: string;
  closingRemark: string;
  budgetStatus: BudgetStatus;
  accountCode: string;
  budgetPlan: number;
  budgetUsed: number;
  requestItems: RequestItem[];
  priceComparisons: PriceComparison[];
  selectedVendor?: PriceComparison | null;
  selectedNotLowest: boolean;
  cleanVendorReason: string;
  effectiveIsPriceAdjustment: boolean;
  priceAdjustmentReason: string;
  effectiveFollowsProductionPlan: boolean;
  effectiveIsDeadStock: boolean;
  showDeptMonthly: boolean;
  deptMonthlyOverBudgetTotal: number;
  orderedReadRecipients: string[];
  recommendation: {
    recommendedFinalApprover: ApprovalLevel;
    notifyMD: boolean;
    requiresMdReview: boolean;
  };
  routeReview: {
    recommendedRoute: ApprovalLevel[];
    mode: ApprovalRouteMode;
    requiresReason: boolean;
  };
  selectedRoute: ApprovalLevel[];
  cleanOverrideReason: string;
  firstCheckingStep: ApprovalLevel;
  /** Which tab of the routing card is active. Absent means the classic Book1 route. */
  routeSource?: "book1" | "custom";
  /** People picked on the "Customize route เอง" tab, in order. */
  customRoutePeople?: ReadonlyArray<{
    userId: number;
    name: string;
    approvalLevel: string | null;
    department: string | null;
  }>;
};

export type MemoDraftOptions = {
  /** Empty string for an Excel preview of a memo that has no number yet — the
   *  form's Ref.No cell is then blank, like an unnumbered paper form. Never
   *  generate one here: memo ids are timestamp-derived, so a preview number
   *  would not match the number issued at submit. */
  id: string;
  requester: string;
  status: MemoStatus;
  /** Display-formatted stamp; used for both createdAt and updatedAt. */
  timestamp: string;
  attachments?: MemoAttachment[];
};

export function buildMemoDraftRecord(
  fields: MemoDraftFields,
  options: MemoDraftOptions,
): MemoRecord {
  const { id, requester, status, timestamp, attachments } = options;

  // Read actions are the acknowledgement queue. A draft has not been sent to
  // anyone, so nobody owes it an acknowledgement yet.
  const readActions: ReadAction[] | undefined =
    status === "pending" && fields.orderedReadRecipients.length > 0
      ? fields.orderedReadRecipients.map((recipient) => ({ recipient, status: "pending" }))
      : undefined;

  // Custom per-person route. These tokens are for local preview only — POST
  // /api/memos rebuilds both the route and the snapshot from the users table
  // (custom-route-server.ts), so a tampered preview cannot reach the DB.
  const custom =
    fields.routeSource === "custom" && (fields.customRoutePeople?.length ?? 0) > 0
      ? buildCustomRoute(fields.customRoutePeople!)
      : null;

  return {
    id,
    title: fields.subject,
    requester,
    department: fields.department,
    category: fields.category,
    itemSubcategoryId: fields.itemSubcategoryId,
    itemSubcategoryLabel: fields.itemSubcategoryLabel,
    amount: fields.amount,
    status,
    currentStep: custom ? custom.route[0] : fields.firstCheckingStep,
    workflowState: "Issued",
    recommendedFinalApprover: fields.recommendation.recommendedFinalApprover,
    recommendedRoute: custom ? custom.route : fields.routeReview.recommendedRoute,
    selectedRoute: custom ? custom.route : fields.selectedRoute,
    // A hand-picked route never matches the Book1 recommendation by construction.
    routeMode: custom ? "exception" : fields.routeReview.mode,
    customRoute: custom ? custom.approvers : undefined,
    // The Book1 override reason does not apply to a custom route — the server
    // records its own reason when it rebuilds the route.
    routeOverrideReason:
      !custom && fields.routeReview.requiresReason ? fields.cleanOverrideReason : undefined,
    readRecipients: fields.orderedReadRecipients,
    readActions,
    description: fields.description.trim() || undefined,
    closingRemark: fields.closingRemark.trim() || undefined,
    budgetStatus: fields.budgetStatus,
    accountCode: fields.accountCode.trim() || undefined,
    budgetPlan: fields.budgetPlan,
    budgetUsed: fields.budgetUsed,
    notifyMD: fields.recommendation.notifyMD,
    requiresMdReview: fields.recommendation.requiresMdReview,
    priceComparisons: fields.priceComparisons,
    selectedVendorId: fields.selectedVendor?.id,
    selectedVendorReason: fields.selectedNotLowest ? fields.cleanVendorReason : undefined,
    // A row the user started and abandoned carries no information; an empty name
    // with a price still does, so the price alone is enough to keep it.
    requestItems: fields.requestItems.filter((r) => r.name.trim() || r.unitPrice > 0),
    attachments,
    priceAdjustmentReason:
      fields.effectiveIsPriceAdjustment && fields.priceAdjustmentReason.trim()
        ? fields.priceAdjustmentReason.trim()
        : undefined,
    isPriceAdjustment: fields.effectiveIsPriceAdjustment || undefined,
    followsProductionPlan: fields.effectiveFollowsProductionPlan || undefined,
    isDeadStockOrSlowMovement: fields.effectiveIsDeadStock || undefined,
    departmentMonthlyOverBudgetTotal:
      fields.showDeptMonthly && fields.deptMonthlyOverBudgetTotal > 0
        ? fields.deptMonthlyOverBudgetTotal
        : undefined,
    cycleHours: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
