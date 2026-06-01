export type ApprovalCategory =
  | "raw-material"
  | "fixed-asset"
  | "service-contract"
  | "general-purchase"
  | "mold";

export type BudgetStatus = "in-budget" | "over-budget" | "no-budget";

export type ApprovalLevel =
  | "Manager / Top Section"
  | "General Manager"
  | "Managing Director";

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

export function computePriceRowTotals(row: { offeredPrice: number; discount: number; vatEnabled?: boolean }) {
  const basePrice = Math.max(0, (row.offeredPrice ?? 0) - (row.discount ?? 0));
  const vatAmount = row.vatEnabled ? Math.round(basePrice * VAT_RATE * 100) / 100 : 0;
  const netPrice = basePrice + vatAmount;
  return { basePrice, vatAmount, netPrice };
}

export type RequestItem = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
};

export type RevisionSource = "initial" | "return" | "rejection-allowed";

export type MemoSnapshot = {
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
  recommendedFinalApprover?: ApprovalLevel;
  recommendedRoute?: ApprovalLevel[];
  selectedRoute?: ApprovalLevel[];
  routeMode?: ApprovalRouteMode;
  routeOverrideReason?: string;
  notifyMD?: boolean;
};

export type MemoRevision = {
  revisionNo: number;
  source: RevisionSource;
  returnReason?: string;
  rejectReason?: string;
  revisionNote?: string;
  submittedAt: string;
  snapshot: MemoSnapshot;
};

export type MemoRecord = {
  id: string;
  title: string;
  requester: string;
  department: string;
  category: ApprovalCategory;
  amount: number;
  status: MemoStatus;
  currentStep: ApprovalLevel;
  workflowState?: WorkflowState;
  recommendedFinalApprover?: ApprovalLevel;
  recommendedRoute?: ApprovalLevel[];
  selectedRoute?: ApprovalLevel[];
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
  budgetStatus?: BudgetStatus;
  accountCode?: string;
  budgetPlan?: number;
  budgetUsed?: number;
  notifyMD?: boolean;
  priceComparisons?: PriceComparison[];
  selectedVendorId?: string;
  selectedVendorReason?: string;
  requestItems?: RequestItem[];
  priceAdjustmentReason?: string;
  isPriceAdjustment?: boolean;
  followsProductionPlan?: boolean;
  isDeadStockOrSlowMovement?: boolean;
  departmentMonthlyOverBudgetTotal?: number;
  cycleHours: number;
  createdAt: string;
  updatedAt: string;
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
    "notifyMD" | "notifyMDReason"
  > = priceAdjustmentActive
    ? {
        notifyMD: true,
        notifyMDReason:
          "Supplier ปรับราคา ต้องแจ้ง MD เพื่อรับทราบ (Book1 หมวด 1/2)"
      }
    : { notifyMD: false };

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

export function analyzeApprovalRoute(
  recommendedFinalApprover: ApprovalLevel,
  selectedRoute: ApprovalLevel[]
): ApprovalRouteReview {
  const recommendedRoute = buildApprovalFlow(recommendedFinalApprover);
  const selectedFinalApprover = getRouteFinalApprover(selectedRoute);
  const recommendedFinalRank = getApprovalLevelRank(recommendedFinalApprover);
  const selectedFinalRank = getApprovalLevelRank(selectedFinalApprover);
  const isSameRoute =
    recommendedRoute.length === selectedRoute.length &&
    recommendedRoute.every((step, index) => step === selectedRoute[index]);
  const skipsRecommendedStep = recommendedRoute.some(
    (step) => !selectedRoute.includes(step)
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

export const seedMemos: MemoRecord[] = [
  {
    id: "EM-2026-001",
    title: "ขออนุมัติซื้ออุปกรณ์สำนักงาน",
    requester: "อำภา หิงคำ",
    department: "HR&GA",
    category: "general-purchase",
    amount: 9200,
    status: "pending",
    currentStep: "Manager / Top Section",
    cycleHours: 12,
    createdAt: "17 May 2026 17:00",
    updatedAt: "18 May 2026 09:20"
  },
  {
    id: "EM-2026-002",
    title: "ซ่อมบำรุงพื้นที่สำนักงาน",
    requester: "Keattisak C.",
    department: "GA",
    category: "service-contract",
    amount: 32000,
    status: "pending",
    currentStep: "General Manager",
    cycleHours: 20,
    createdAt: "17 May 2026 10:00",
    updatedAt: "18 May 2026 08:10"
  },
  {
    id: "EM-2026-003",
    title: "ต่ออายุระบบจัดเก็บเอกสาร",
    requester: "IT Support",
    department: "IT",
    category: "service-contract",
    amount: 76000,
    status: "approved",
    currentStep: "Managing Director",
    cycleHours: 16,
    createdAt: "17 May 2026 08:00",
    updatedAt: "17 May 2026 16:40"
  },
  {
    id: "EM-2026-004",
    title: "ทดลองซื้อวัสดุประกอบ",
    requester: "Production",
    department: "PD",
    category: "raw-material",
    amount: 48000,
    status: "pending",
    currentStep: "General Manager",
    cycleHours: 28,
    createdAt: "16 May 2026 10:00",
    updatedAt: "17 May 2026 14:05"
  },
  {
    id: "EM-2026-005",
    title: "ซื้อเครื่องมือโรงงาน",
    requester: "Maintenance",
    department: "MT",
    category: "fixed-asset",
    amount: 98000,
    status: "approved",
    currentStep: "General Manager",
    cycleHours: 15,
    createdAt: "16 May 2026 08:00",
    updatedAt: "16 May 2026 11:30"
  },
  {
    id: "EM-2026-006",
    title: "ปรับราคาแม่พิมพ์งานตัวอย่าง",
    requester: "Engineering",
    department: "EN",
    category: "mold",
    amount: 45000,
    status: "rejected",
    currentStep: "Managing Director",
    cycleHours: 18,
    createdAt: "15 May 2026 15:00",
    updatedAt: "16 May 2026 10:05"
  },
  {
    id: "EM-2026-007",
    title: "ขอซื้อวัสดุสวัสดิการพนักงาน",
    requester: "HR Team",
    department: "HR",
    category: "general-purchase",
    amount: 12500,
    status: "approved",
    currentStep: "General Manager",
    cycleHours: 17,
    createdAt: "15 May 2026 09:00",
    updatedAt: "15 May 2026 15:25"
  },
  {
    id: "EM-2026-008",
    title: "ขออนุมัติค่าใช้จ่ายอบรมผู้ใช้งาน",
    requester: "Project Intern",
    department: "HR&GA IT",
    category: "service-contract",
    amount: 18000,
    status: "pending",
    currentStep: "General Manager",
    cycleHours: 18,
    createdAt: "14 May 2026 19:00",
    updatedAt: "15 May 2026 13:00"
  }
];

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
