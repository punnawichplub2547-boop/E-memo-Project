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

export type MemoAttachment = {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

export type RevisionSource = "initial" | "return" | "rejection-allowed";

export type MemoSnapshot = {
  title: string;
  category: ApprovalCategory;
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
  /** Stable FK to the creating user (users.id). Optional: legacy/seed/prototype
   *  rows have no real user → identity paths fall back to requester name match.
   *  When set, it is authoritative — never fall back to the name. */
  requesterUserId?: number | null;
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
  closingRemark?: string;
  budgetStatus?: BudgetStatus;
  accountCode?: string;
  budgetPlan?: number;
  budgetUsed?: number;
  notifyMD?: boolean;
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
    // Pending at Manager — just submitted today; good for "new request" demo
    id: "EM-2026-001",
    title: "ขออนุมัติจัดซื้ออุปกรณ์สำนักงาน",
    requester: "ปุณณวิช ภูประเสริฐ",
    department: "HR&GA",
    category: "general-purchase",
    amount: 9200,
    description: "ขออนุมัติจัดซื้อเก้าอี้ทำงานเออร์โกโนมิก 4 ตัว และโต๊ะทำงาน 2 ตัว เพื่อรองรับพนักงานใหม่ฝ่าย HR&GA ที่จะเข้างานในเดือนมิถุนายน 2026",
    budgetStatus: "in-budget",
    accountCode: "5101-001",
    budgetPlan: 20000,
    budgetUsed: 8500,
    status: "pending",
    workflowState: "Issued",
    currentStep: "Manager / Top Section",
    recommendedFinalApprover: "Manager / Top Section",
    recommendedRoute: ["Manager / Top Section"],
    selectedRoute: ["Manager / Top Section"],
    routeMode: "recommended",
    cycleHours: 4,
    createdAt: "09 Jun 2026 09:15",
    updatedAt: "09 Jun 2026 09:15",
  },
  {
    // Pending at GM — mid-approval; good for showing workflow progress
    id: "EM-2026-002",
    title: "ขออนุมัติซ่อมบำรุงระบบไฟฟ้าโรงงาน",
    requester: "สมศักดิ์ วงศ์ไพบูลย์",
    department: "GA",
    category: "service-contract",
    amount: 45000,
    description: "ขออนุมัติค่าบริการตรวจสอบและซ่อมแซมระบบไฟฟ้าแรงสูงในพื้นที่โรงงาน 2 โดยบริษัทผู้รับเหมาที่ได้รับการรับรอง เพื่อความปลอดภัยในการปฏิบัติงานตามมาตรฐาน ISO 45001",
    budgetStatus: "in-budget",
    accountCode: "5301-002",
    budgetPlan: 100000,
    budgetUsed: 22000,
    status: "pending",
    workflowState: "Checked",
    currentStep: "General Manager",
    recommendedFinalApprover: "General Manager",
    recommendedRoute: ["Manager / Top Section", "General Manager"],
    selectedRoute: ["Manager / Top Section", "General Manager"],
    routeMode: "recommended",
    cycleHours: 20,
    createdAt: "07 Jun 2026 10:00",
    updatedAt: "08 Jun 2026 08:10",
  },
  {
    // Pending at MD — high-value asset; star of the Executive Review demo
    id: "EM-2026-003",
    title: "ขออนุมัติจัดซื้อเครื่องอัดยางอัตโนมัติ",
    requester: "สุภาพร เจริญสุข",
    department: "PD",
    category: "fixed-asset",
    amount: 240000,
    description: "ขออนุมัติจัดซื้อเครื่องอัดยางอัตโนมัติ รุ่น CAR-X500 จำนวน 1 เครื่อง เพื่อเพิ่มกำลังการผลิตในไลน์ยางกันกระแทก รองรับออเดอร์ที่คาดว่าจะเพิ่มขึ้น 35% ในไตรมาส 3 ปี 2026",
    budgetStatus: "in-budget",
    accountCode: "6001-001",
    budgetPlan: 500000,
    budgetUsed: 180000,
    status: "pending",
    workflowState: "Checked",
    currentStep: "Managing Director",
    recommendedFinalApprover: "Managing Director",
    recommendedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    selectedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    routeMode: "recommended",
    cycleHours: 28,
    createdAt: "05 Jun 2026 08:00",
    updatedAt: "08 Jun 2026 14:30",
  },
  {
    // Approved — raw material following production plan
    id: "EM-2026-004",
    title: "ขออนุมัติจัดซื้อยางธรรมชาติตามแผนการผลิต",
    requester: "สุภาพร เจริญสุข",
    department: "PD",
    category: "raw-material",
    amount: 68000,
    description: "ขออนุมัติจัดซื้อยางธรรมชาติเกรด RSS3 จำนวน 2,000 กก. ตามแผนการผลิตประจำสัปดาห์ที่ 23–24 เพื่อรองรับออเดอร์ลูกค้าหลัก (Toyota Supplier)",
    budgetStatus: "in-budget",
    accountCode: "4001-001",
    budgetPlan: 800000,
    budgetUsed: 420000,
    followsProductionPlan: true,
    status: "approved",
    workflowState: "Approved",
    currentStep: "General Manager",
    recommendedFinalApprover: "General Manager",
    recommendedRoute: ["Manager / Top Section", "General Manager"],
    selectedRoute: ["Manager / Top Section", "General Manager"],
    routeMode: "recommended",
    cycleHours: 8,
    createdAt: "04 Jun 2026 07:30",
    updatedAt: "04 Jun 2026 15:45",
  },
  {
    // Approved — IT software renewal; shows full MD-tier completed flow
    id: "EM-2026-005",
    title: "ขออนุมัติต่ออายุซอฟต์แวร์ Microsoft 365",
    requester: "ปุณณวิช ภูประเสริฐ",
    department: "IT",
    category: "service-contract",
    amount: 76000,
    description: "ขออนุมัติต่ออายุสัญญาซอฟต์แวร์ Microsoft 365 Business สำหรับพนักงาน 38 คน ประจำปี 2026–2027 เพื่อความต่อเนื่องในการทำงานและการเข้าถึงอีเมล OneDrive และ Teams",
    budgetStatus: "in-budget",
    accountCode: "5201-001",
    budgetPlan: 100000,
    budgetUsed: 76000,
    status: "approved",
    workflowState: "Approved",
    currentStep: "Managing Director",
    recommendedFinalApprover: "Managing Director",
    recommendedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    selectedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    routeMode: "recommended",
    cycleHours: 16,
    createdAt: "02 Jun 2026 09:00",
    updatedAt: "03 Jun 2026 11:00",
  },
  {
    // Returned — missing quotation docs; good for revision flow demo
    id: "EM-2026-006",
    title: "ขออนุมัติจัดงานกิจกรรมพนักงานประจำปี",
    requester: "นัดดา หาญกล้า",
    department: "HR&GA",
    category: "general-purchase",
    amount: 28000,
    description: "ขออนุมัติงบประมาณจัดงาน Company Outing ประจำปี 2026 สำหรับพนักงาน 85 คน รวมค่าสถานที่ อาหาร และกิจกรรมสันทนาการ",
    budgetStatus: "in-budget",
    accountCode: "5102-001",
    budgetPlan: 50000,
    budgetUsed: 0,
    status: "returned",
    workflowState: "Issued",
    currentStep: "Manager / Top Section",
    recommendedFinalApprover: "General Manager",
    recommendedRoute: ["Manager / Top Section", "General Manager"],
    selectedRoute: ["Manager / Top Section", "General Manager"],
    routeMode: "recommended",
    returnReason: "กรุณาแนบใบเสนอราคาให้ครบ 3 ราย และระบุจำนวนผู้เข้าร่วมงานที่ชัดเจน",
    cycleHours: 6,
    createdAt: "06 Jun 2026 13:00",
    updatedAt: "07 Jun 2026 09:30",
  },
  {
    // Approved — safety equipment; shows GM-tier completed
    id: "EM-2026-007",
    title: "ขออนุมัติจัดซื้ออุปกรณ์ป้องกันส่วนบุคคล",
    requester: "นิรัน พงษ์ประเสริฐ",
    department: "GA",
    category: "general-purchase",
    amount: 12500,
    description: "ขออนุมัติจัดซื้อหมวกนิรภัย รองเท้าเซฟตี้ และถุงมือป้องกันสารเคมี สำหรับพนักงานโรงงาน 10 คน ตามมาตรฐาน ISO 45001:2018",
    budgetStatus: "in-budget",
    accountCode: "5302-001",
    budgetPlan: 30000,
    budgetUsed: 12500,
    status: "approved",
    workflowState: "Approved",
    currentStep: "General Manager",
    recommendedFinalApprover: "General Manager",
    recommendedRoute: ["Manager / Top Section", "General Manager"],
    selectedRoute: ["Manager / Top Section", "General Manager"],
    routeMode: "recommended",
    cycleHours: 17,
    createdAt: "01 Jun 2026 09:00",
    updatedAt: "02 Jun 2026 10:15",
  },
  {
    // Rejected (revision-allowed) — over budget; shows rejection + re-submit path
    id: "EM-2026-008",
    title: "ขออนุมัติจ้างที่ปรึกษาระบบคุณภาพ ISO",
    requester: "วิทย์ ตระกูลงาม",
    department: "QA",
    category: "service-contract",
    amount: 95000,
    description: "ขออนุมัติว่าจ้างบริษัทที่ปรึกษาเพื่อปรับปรุงระบบคุณภาพ ISO 9001:2015 และ IATF 16949 รองรับการตรวจประเมินประจำปีในเดือนสิงหาคม 2026",
    budgetStatus: "over-budget",
    accountCode: "5401-001",
    budgetPlan: 80000,
    budgetUsed: 0,
    status: "rejected",
    workflowState: "Rejected",
    currentStep: "Managing Director",
    recommendedFinalApprover: "Managing Director",
    recommendedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    selectedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    routeMode: "recommended",
    rejectReason: "งบประมาณเกินแผนที่ตั้งไว้ กรุณาทบทวนขอบเขตงานและเจรจาราคาใหม่ให้อยู่ในกรอบ แล้วยื่นขออนุมัติอีกครั้ง",
    rejectDisposition: "revision-allowed",
    cycleHours: 18,
    createdAt: "30 May 2026 15:00",
    updatedAt: "02 Jun 2026 14:05",
  },
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
