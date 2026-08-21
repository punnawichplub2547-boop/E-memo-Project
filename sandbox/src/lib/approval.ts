import type { CustomApprover, CustomStepKey } from "./custom-route";
import type { NotifyNoteImage } from "./notify-note";
import type { MemoBodyBlock, MemoFormMode } from "./memo-body-blocks";
import type { MemoRevision } from "./memo-revision";
import type { RequestItem, MemoAttachment } from "./memo-line-items";

export type { CustomApprover };

export type ApprovalCategory =
  | "raw-material"
  | "fixed-asset"
  | "service-contract"
  | "general-purchase"
  | "mold";

export type BudgetStatus = "in-budget" | "over-budget" | "no-budget";

export type ApprovalLevel =
  | "Supervisor"
  | "Manager / Top Section"
  | "General Manager"
  | "Managing Director";

/** A step in a memo's route. Either a Book1 approval level, or a per-person
 *  token from custom-route.ts. Both are plain strings in selected_route_json. */
export type ApprovalStepKey = ApprovalLevel | CustomStepKey;

export type WorkflowState =
  | "Issued"
  | "Checked"
  | "Read"
  | "Approved"
  | "Rejected";

export type ApprovalRouteMode = "recommended" | "escalated" | "exception";

export type ApprovalRouteReview = {
  recommendedRoute: ApprovalLevel[];
  selectedRoute: ApprovalLevel[];
  mode: ApprovalRouteMode;
  requiresReason: boolean;
  reasonLabel: string;
};

export type ApprovalInput = {
  category: ApprovalCategory;
  amount: number;
  budgetStatus: BudgetStatus;
  /** Supplier price adjustment - categories 1 and 2 only; triggers MD notification */
  isPriceAdjustment?: boolean;
  /** Raw material per production plan - recommend GM regardless of amount */
  followsProductionPlan?: boolean;
  /** Raw material flagged as dead stock or slow movement - UI tag only */
  isDeadStockOrSlowMovement?: boolean;
  /** Sum of over-budget approvals already granted this month for the requesting department */
  departmentMonthlyOverBudgetTotal?: number;
};

export type ApprovalRecommendation = {
  recommendedFinalApprover: ApprovalLevel;
  reason: string;
  notifyMD: boolean;
  notifyMDReason?: string;
  requiresMdReview: boolean;
};

export type MemoStatus = "draft" | "pending" | "approved" | "rejected" | "returned";

export type ReadActionStatus = "pending" | "read" | "skipped";

export type ReadAction = {
  recipient: string;
  status: ReadActionStatus;
  actedAt?: string;
  skipReason?: string;
};

export type PriceComparison = {
  id: string;
  vendorName: string;
  offeredPrice: number;
  discount: number;
  vatEnabled?: boolean;
  netPrice: number;
  remark?: string;
  isSelected: boolean;
};

export const VAT_RATE = 0.07;

export const NON_NEGOTIABLE_REMARK = "ไม่สามารถต่อรองราคาได้";

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computePriceRowTotals(row: { offeredPrice: number; discount: number; vatEnabled?: boolean }) {
  const offeredPrice = row.offeredPrice ?? 0;
  const discount = row.discount ?? 0;
  const basePrice = Math.max(0, offeredPrice - discount);
  const vatAmount = row.vatEnabled ? Math.round(basePrice * VAT_RATE * 100) / 100 : 0;
  const netPrice = basePrice + vatAmount;
  // Percent is derived from the pre-VAT offered price so it stays consistent with
  // basePrice, which subtracts the discount before VAT is applied.
  const discountPercent = offeredPrice > 0 ? roundTo2((discount / offeredPrice) * 100) : 0;
  return { basePrice, vatAmount, netPrice, discountPercent };
}

export function discountAmountFromPercent(offeredPrice: number, percent: number): number {
  const price = offeredPrice ?? 0;
  if (price <= 0) return 0;
  const clampedPercent = Math.min(100, Math.max(0, percent ?? 0));
  return roundTo2((price * clampedPercent) / 100);
}

export function needsNonNegotiableRemark(
  row: Pick<PriceComparison, "offeredPrice" | "discount" | "isSelected">
): boolean {
  return Boolean(row.isSelected) && (row.offeredPrice ?? 0) > 0 && (row.discount ?? 0) <= 0;
}

// Pure types, split out to ./memo-line-items to keep this file under its line-count guardrail.
export type { RequestItem, MemoAttachment };

export type RevisionSource = "initial" | "return" | "rejection-allowed";

export type MemoSnapshot = {
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
  attachments?: MemoAttachment[];
  priceComparisons?: PriceComparison[];
  selectedVendorId?: string;
  selectedVendorReason?: string;
  priceAdjustmentReason?: string;
  isPriceAdjustment?: boolean;
  followsProductionPlan?: boolean;
  isDeadStockOrSlowMovement?: boolean;
  departmentMonthlyOverBudgetTotal?: number;
  readRecipients?: string[];
  recommendedFinalApprover?: ApprovalLevel;
  recommendedRoute?: ApprovalStepKey[];
  selectedRoute?: ApprovalStepKey[];
  /** Display snapshot for a per-person route. Undefined for level routes. */
  customRoute?: CustomApprover[];
  routeMode?: ApprovalRouteMode;
  routeOverrideReason?: string;
  notifyMD?: boolean;
  requiresMdReview?: boolean;
  mdReviewStatus?: "pending" | "completed" | "escalated";
  mdReviewResumeStep?: ApprovalStepKey;
  mdReviewComment?: string;
  mdReviewActedBy?: string;
  mdReviewActedAt?: string;
  /** V3: freeform-body memo form. Undefined/"standard" = the regular fixed-field form. */
  formMode?: MemoFormMode;
  bodyBlocks?: MemoBodyBlock[];
};

// Pure type, split out to ./memo-revision to keep this file under its line-count guardrail.
export type { MemoRevision };

export type MemoRecord = {
  id: string;
  title: string;
  requester: string;
  /** Stable FK to the creating user (users.id). Optional: legacy/seed/prototype
   *  rows have no real user → identity paths fall back to requester name match.
   *  When set, it is authoritative — never fall back to the name. */
  requesterUserId?: number | null;
  department: string;
  category: ApprovalCategory;
  itemSubcategoryId?: number;
  itemSubcategoryLabel?: string;
  amount: number;
  status: MemoStatus;
  currentStep: ApprovalStepKey;
  workflowState?: WorkflowState;
  recommendedFinalApprover?: ApprovalLevel;
  recommendedRoute?: ApprovalStepKey[];
  selectedRoute?: ApprovalStepKey[];
  /** Display snapshot for a per-person route. Undefined for level routes. */
  customRoute?: CustomApprover[];
  routeMode?: ApprovalRouteMode;
  routeOverrideReason?: string;
  readRecipients?: string[];
  readActions?: ReadAction[];
  returnReason?: string;
  revisionNote?: string;
  rejectDisposition?: "close" | "revision-allowed";
  rejectReason?: string;
  revisionNo?: number;
  revisionSubmittedAt?: string;
  revisions?: MemoRevision[];
  description?: string;
  closingRemark?: string;
  /** V2 §3: ข้อความ (+รูป) ที่ส่งไปกับการแจ้งเตือนตอนส่งครั้งแรกเท่านั้น
   *  ไม่ขึ้นในตัวเมโมและไม่ขึ้นในฟอร์ม F-DC-006 (Q14) — จึงไม่ถูกอ่านกลับมาโดย
   *  serializeMemoRecord() และมีค่าเฉพาะบน record ที่ client เพิ่งสร้างเท่านั้น */
  notifyNote?: string;
  notifyNoteImages?: NotifyNoteImage[];
  notifyAttachExcel?: boolean;
  budgetStatus?: BudgetStatus;
  accountCode?: string;
  budgetPlan?: number;
  budgetUsed?: number;
  notifyMD?: boolean;
  requiresMdReview?: boolean;
  mdReviewStatus?: "pending" | "completed" | "escalated";
  mdReviewResumeStep?: ApprovalStepKey;
  mdReviewComment?: string;
  mdReviewActedBy?: string;
  mdReviewActedAt?: string;
  priceComparisons?: PriceComparison[];
  selectedVendorId?: string;
  selectedVendorReason?: string;
  requestItems?: RequestItem[];
  attachments?: MemoAttachment[];
  priceAdjustmentReason?: string;
  isPriceAdjustment?: boolean;
  followsProductionPlan?: boolean;
  isDeadStockOrSlowMovement?: boolean;
  departmentMonthlyOverBudgetTotal?: number;
  cycleHours: number;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete marker. Undefined = active; a display timestamp = voided/archived by admin.
   *  Voided memos are filtered out of all active views but kept in the DB for audit + restore. */
  deletedAt?: string;
  /** V3 form: form_mode is the DB source of truth, never inferred from bodyBlocks
   *  presence/emptiness — see parseBodyBlocksJson in db-memos.ts. */
  formMode?: MemoFormMode;
  bodyBlocks?: MemoBodyBlock[];
};

const managerLimit = 10000;
const gmLimit = 50000;
const fixedAssetGmLimit = 100000;
const overBudgetMonthlyDeptQuota = 10000;

export const approvalLabels: Record<ApprovalCategory, string> = {
  "raw-material": "วัตถุดิบ / ชิ้นงานเพื่อการผลิต",
  "fixed-asset": "สินทรัพย์ถาวร",
  "service-contract": "การว่าจ้าง / สัญญา / งานบริการ",
  "general-purchase": "ซื้อทั่วไป",
  mold: "แม่พิมพ์"
};

export const approvalLevels: ApprovalLevel[] = [
  "Manager / Top Section",
  "General Manager",
  "Managing Director"
];

export function getApprovalRecommendation(
  input: ApprovalInput
): ApprovalRecommendation {
  const supportsPriceAdjustment =
    input.category === "raw-material" || input.category === "fixed-asset";
  const priceAdjustmentActive =
    Boolean(input.isPriceAdjustment) && supportsPriceAdjustment;

  const notifyMDFields: Pick<
    ApprovalRecommendation,
    "notifyMD" | "notifyMDReason" | "requiresMdReview"
  > = priceAdjustmentActive
    ? {
        notifyMD: true,
        notifyMDReason:
          "Supplier ปรับราคา ต้องผ่านการพิจารณาของ MD ก่อนอนุมัติ (Book1 หมวด 1/2)",
        requiresMdReview: true
      }
    : { notifyMD: false, requiresMdReview: false }

  if (input.category === "mold") {
    return {
      recommendedFinalApprover: "Managing Director",
      reason: "แม่พิมพ์ ต้องเสนอ MD ทุกครั้ง (Book1 ข้อ 5)",
      ...notifyMDFields
    };
  }

  if (input.category === "raw-material" && input.followsProductionPlan) {
    return {
      recommendedFinalApprover: "General Manager",
      reason: "วัตถุดิบ ตามแผนการผลิต -> GM (Book1 ข้อ 1.1)",
      ...notifyMDFields
    };
  }

  if (input.budgetStatus !== "in-budget") {
    const deptCumulative = input.departmentMonthlyOverBudgetTotal ?? 0;
    const wouldExceedDeptQuota =
      deptCumulative + input.amount > overBudgetMonthlyDeptQuota;

    if (input.amount <= managerLimit && !wouldExceedDeptQuota) {
      return {
        recommendedFinalApprover: "General Manager",
        reason: "เกิน/ไม่มีใน Budget ภายในวงเงิน 10,000 บาท ยอดสะสมแผนกเดือนนี้ " + deptCumulative.toLocaleString() + " บาท ยังไม่เกินโควต้า 10,000 -> GM",
        ...notifyMDFields
      };
    }

    if (wouldExceedDeptQuota && input.amount <= managerLimit) {
      return {
        recommendedFinalApprover: "Managing Director",
        reason: "ยอด over-budget สะสมของแผนกเดือนนี้ (" + deptCumulative.toLocaleString() + ") + รายการนี้ (" + input.amount.toLocaleString() + ") เกินโควต้า 10,000 บาท/แผนก/เดือน -> เสนอ MD",
        ...notifyMDFields
      };
    }

    return {
      recommendedFinalApprover: "Managing Director",
      reason: "เกิน/ไม่มีใน Budget วงเงิน 10,001 บาทขึ้นไป -> เสนอ MD",
      ...notifyMDFields
    };
  }

  if (input.category === "fixed-asset") {
    if (input.amount <= fixedAssetGmLimit) {
      return {
        recommendedFinalApprover: "General Manager",
        reason: "สินทรัพย์ถาวร ภายใน Budget <= 100,000 บาท -> GM (Book1 ข้อ 2.1)",
        ...notifyMDFields
      };
    }
    return {
      recommendedFinalApprover: "Managing Director",
      reason: "สินทรัพย์ถาวร ภายใน Budget เกิน 100,000 บาท -> MD (Book1 ข้อ 2.2)",
      ...notifyMDFields
    };
  }

  if (input.category === "raw-material") {
    if (input.amount <= managerLimit) {
      return {
        recommendedFinalApprover: "General Manager",
        reason: "วัตถุดิบ ภายใน Budget <= 10,000 บาท -> GM (Book1 ข้อ 1.2 - หมวดนี้ไม่ให้ Manager อนุมัติ)",
        ...notifyMDFields
      };
    }
    if (input.amount <= gmLimit) {
      return {
        recommendedFinalApprover: "General Manager",
        reason: "วัตถุดิบ ภายใน Budget 10,001-50,000 บาท -> GM (Book1 ข้อ 1.3)",
        ...notifyMDFields
      };
    }
    return {
      recommendedFinalApprover: "Managing Director",
      reason: "วัตถุดิบ ภายใน Budget เกิน 50,000 บาท -> MD (Book1 ข้อ 1.4)",
      ...notifyMDFields
    };
  }

  if (input.amount <= managerLimit) {
    return {
      recommendedFinalApprover: "Manager / Top Section",
      reason: approvalLabels[input.category] + " ภายใน Budget <= 10,000 บาท -> Manager / Top Section",
      ...notifyMDFields
    };
  }

  if (input.amount <= gmLimit) {
    return {
      recommendedFinalApprover: "General Manager",
      reason: approvalLabels[input.category] + " ภายใน Budget 10,001-50,000 บาท -> GM",
      ...notifyMDFields
    };
  }

  return {
    recommendedFinalApprover: "Managing Director",
    reason: approvalLabels[input.category] + " ภายใน Budget เกิน 50,000 บาท -> MD",
    ...notifyMDFields
  };
}

export function getApprovalLevel(input: ApprovalInput): ApprovalLevel {
  return getApprovalRecommendation(input).recommendedFinalApprover;
}

export function buildApprovalFlow(
  chosenFinalApprover: ApprovalLevel,
  options: { respectChosenOnly?: boolean } = {}
): ApprovalLevel[] {
  if (options.respectChosenOnly) {
    return chosenFinalApprover === "Manager / Top Section"
      ? ["Manager / Top Section"]
      : ["Manager / Top Section", chosenFinalApprover];
  }
  const targetIndex = approvalLevels.indexOf(chosenFinalApprover);
  return approvalLevels.slice(0, targetIndex + 1);
}

export function getApprovalLevelRank(level: ApprovalLevel): number {
  return approvalLevels.indexOf(level);
}

export function getRouteFinalApprover(route: ApprovalLevel[]): ApprovalLevel {
  return route[route.length - 1] ?? "Manager / Top Section";
}

// Supervisor is an optional dept-scoped check step prepended before the mandatory
// Manager step. It is deliberately NOT on the rank ladder (approvalLevels), so the
// Book1 amount/budget matrix never produces it. Route-mode analysis must ignore it
// on BOTH sides — otherwise a route that only added a legitimate Supervisor prefix
// would compare unequal to the recommendation and be flagged a false "exception",
// and getRouteFinalApprover/rank logic could misread it.
function stripSupervisor(route: ApprovalLevel[]): ApprovalLevel[] {
  return route.filter((step) => step !== "Supervisor");
}

export function analyzeApprovalRoute(
  recommendedFinalApprover: ApprovalLevel,
  selectedRoute: ApprovalLevel[]
): ApprovalRouteReview {
  const recommendedRoute = stripSupervisor(buildApprovalFlow(recommendedFinalApprover));
  const comparableSelectedRoute = stripSupervisor(selectedRoute);
  const selectedFinalApprover = getRouteFinalApprover(comparableSelectedRoute);
  const recommendedFinalRank = getApprovalLevelRank(recommendedFinalApprover);
  const selectedFinalRank = getApprovalLevelRank(selectedFinalApprover);
  const isSameRoute =
    recommendedRoute.length === comparableSelectedRoute.length &&
    recommendedRoute.every((step, index) => step === comparableSelectedRoute[index]);
  const skipsRecommendedStep = recommendedRoute.some(
    (step) => !comparableSelectedRoute.includes(step)
  );

  if (isSameRoute) {
    return {
      recommendedRoute,
      selectedRoute,
      mode: "recommended",
      requiresReason: false,
      reasonLabel: "Uses Book1 recommended stair route"
    };
  }

  if (selectedFinalRank > recommendedFinalRank && !skipsRecommendedStep) {
    return {
      recommendedRoute,
      selectedRoute,
      mode: "escalated",
      requiresReason: false,
      reasonLabel: "Escalated above Book1 recommendation"
    };
  }

  return {
    recommendedRoute,
    selectedRoute,
    mode: "exception",
    requiresReason: true,
    reasonLabel:
      selectedFinalRank < recommendedFinalRank
        ? "Selected final approver is below Book1 recommendation"
        : "Selected route skips one or more recommended steps"
  };
}

/**
 * Whether a free-form memo's per-person ("custom") route requires an
 * override reason because its final approver ranks below what Book1 would
 * recommend. This deliberately does NOT reuse analyzeApprovalRoute(): that
 * function compares two Book1 *routes* built by buildApprovalFlow(), which
 * has nothing to do with the people actually picked on the custom-route tab
 * — plugging a custom route's steps into it would check the wrong thing
 * (Ruling 14 / Task 10 fix round 1, F1). Only the FINAL position approves in
 * a custom route (see custom-route.ts's Q4 role rule), so comparing just
 * that person's recorded approval_level against the recommendation is what
 * the spec's "สายที่เลือกต่ำกว่าที่แนะนำ" rule means once the route is a list of
 * people rather than a ladder. An empty list requires no reason yet — there
 * is nothing to justify until canSubmitCustom's "pick at least one person"
 * gate is satisfied. A missing or unrecognized approval_level ranks below
 * everything (getApprovalLevelRank returns -1 for both), so it conservatively
 * requires a reason rather than silently letting an unverifiable level pass.
 */
export function requiresOverrideReasonForCustomRoute(
  recommendedFinalApprover: ApprovalLevel,
  people: { approvalLevel: string | null }[]
): boolean {
  if (people.length === 0) return false;
  const rawLevel = people[people.length - 1].approvalLevel;
  const finalRank = rawLevel ? getApprovalLevelRank(rawLevel as ApprovalLevel) : -1;
  return finalRank < getApprovalLevelRank(recommendedFinalApprover);
}

// Demo fixture, split out to ./seed-memos to keep this file under its 700-line guardrail.
export { seedMemos } from "./seed-memos";

export function getDashboardMetrics(memos: MemoRecord[]) {
  const statusCount = (status: MemoStatus) =>
    memos.filter((memo) => memo.status === status).length;
  const averageCycleHours = memos.length
    ? Math.round(memos.reduce((sum, memo) => sum + memo.cycleHours, 0) / memos.length)
    : 0;
  return {
    total: memos.length,
    pending: statusCount("pending"),
    approved: statusCount("approved"),
    rejected: statusCount("rejected"),
    averageCycleHours
  };
}
