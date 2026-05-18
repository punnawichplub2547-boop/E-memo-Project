export type ApprovalCategory =
  | "raw-material"
  | "fixed-asset"
  | "service-contract"
  | "general-purchase"
  | "mold";

export type BudgetStatus = "in-budget" | "over-budget" | "no-budget";

export type ApprovalInput = {
  category: ApprovalCategory;
  amount: number;
  budgetStatus: BudgetStatus;
};

export type ApprovalLevel =
  | "Manager / Top Section"
  | "General Manager"
  | "Managing Director";

export type MemoStatus = "draft" | "pending" | "approved" | "rejected";

export type MemoRecord = {
  id: string;
  title: string;
  requester: string;
  department: string;
  category: ApprovalCategory;
  amount: number;
  status: MemoStatus;
  currentStep: ApprovalLevel;
  cycleHours: number;
  updatedAt: string;
};

const managerLimit = 10000;
const gmLimit = 50000;

export const approvalLabels: Record<ApprovalCategory, string> = {
  "raw-material": "วัตถุดิบ / ชิ้นงานเพื่อการผลิต",
  "fixed-asset": "สินทรัพย์ถาวร",
  "service-contract": "การว่าจ้าง / สัญญา / งานบริการ",
  "general-purchase": "ซื้อทั่วไป",
  mold: "แม่พิมพ์"
};

export function getApprovalLevel(input: ApprovalInput): ApprovalLevel {
  if (input.category === "mold") {
    return "Managing Director";
  }

  if (input.category === "fixed-asset") {
    if (input.budgetStatus === "in-budget" && input.amount <= 100000) {
      return "General Manager";
    }

    return "Managing Director";
  }

  if (input.budgetStatus !== "in-budget") {
    return input.amount <= managerLimit ? "General Manager" : "Managing Director";
  }

  if (input.amount <= managerLimit) {
    return "Manager / Top Section";
  }

  if (input.amount <= gmLimit) {
    return "General Manager";
  }

  return "Managing Director";
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
    updatedAt: "15 May 2026 13:00"
  }
];

export function getDashboardMetrics(memos: MemoRecord[]) {
  const statusCount = (status: MemoStatus) =>
    memos.filter((memo) => memo.status === status).length;
  const averageCycleHours = Math.round(
    memos.reduce((sum, memo) => sum + memo.cycleHours, 0) / memos.length
  );

  return {
    total: memos.length,
    pending: statusCount("pending"),
    approved: statusCount("approved"),
    rejected: statusCount("rejected"),
    averageCycleHours
  };
}
