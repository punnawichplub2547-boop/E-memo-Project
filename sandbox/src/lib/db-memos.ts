import type {
  ApprovalCategory,
  ApprovalLevel,
  ApprovalRouteMode,
  BudgetStatus,
  MemoRecord,
  MemoStatus,
  PriceComparison,
  ReadAction,
  ReadActionStatus,
  RequestItem,
  WorkflowState,
} from "./approval";

type DbDate = string | Date;
type DbBoolean = boolean | 0 | 1;
type DbJson = string | unknown[] | null;
type DbNumber = string | number | null;

export type MemoDbRow = {
  id: number;
  memo_no: string;
  title: string;
  requester_name: string;
  department_name: string;
  category: string;
  amount: DbNumber;
  budget_status: string | null;
  account_code: string | null;
  budget_plan: DbNumber;
  budget_used: DbNumber;
  description: string | null;
  status: string;
  workflow_state: string | null;
  current_step: string;
  cycle_hours: number | null;
  recommended_final_approver: string | null;
  recommended_route_json: DbJson;
  selected_route_json: DbJson;
  route_mode: string | null;
  route_override_reason: string | null;
  notify_md: DbBoolean;
  is_price_adjustment: DbBoolean;
  follows_production_plan: DbBoolean;
  is_dead_stock: DbBoolean;
  dept_monthly_over_budget_total: DbNumber;
  return_reason: string | null;
  reject_reason: string | null;
  reject_disposition: string | null;
  revision_no: number;
  revision_submitted_at: DbDate | null;
  revision_note: string | null;
  price_comparisons_json: DbJson;
  selected_vendor_id: string | null;
  selected_vendor_reason: string | null;
  price_adjustment_reason: string | null;
  request_items_json: DbJson;
  read_recipients_json: DbJson;
  created_at: DbDate;
  updated_at: DbDate;
};

export type ReadActionDbRow = {
  recipient_name: string;
  status: string;
  acted_at: DbDate | null;
  skip_reason: string | null;
};

export function serializeMemoRecord(row: MemoDbRow, readActions: ReadActionDbRow[]): MemoRecord {
  return {
    id: row.memo_no,
    title: row.title,
    requester: row.requester_name,
    department: row.department_name,
    category: row.category as ApprovalCategory,
    amount: toNumber(row.amount) ?? 0,
    budgetStatus: optional(row.budget_status) as BudgetStatus | undefined,
    accountCode: optional(row.account_code),
    budgetPlan: toNumber(row.budget_plan),
    budgetUsed: toNumber(row.budget_used),
    description: optional(row.description),
    status: row.status as MemoStatus,
    workflowState: optional(row.workflow_state) as WorkflowState | undefined,
    currentStep: row.current_step as ApprovalLevel,
    cycleHours: row.cycle_hours ?? 0,
    recommendedFinalApprover: optional(row.recommended_final_approver) as ApprovalLevel | undefined,
    recommendedRoute: parseJsonArray<ApprovalLevel>(row.recommended_route_json),
    selectedRoute: parseJsonArray<ApprovalLevel>(row.selected_route_json),
    routeMode: optional(row.route_mode) as ApprovalRouteMode | undefined,
    routeOverrideReason: optional(row.route_override_reason),
    notifyMD: toBoolean(row.notify_md),
    isPriceAdjustment: toBoolean(row.is_price_adjustment),
    followsProductionPlan: toBoolean(row.follows_production_plan),
    isDeadStockOrSlowMovement: toBoolean(row.is_dead_stock),
    departmentMonthlyOverBudgetTotal: toNumber(row.dept_monthly_over_budget_total),
    returnReason: optional(row.return_reason),
    rejectReason: optional(row.reject_reason),
    rejectDisposition: optional(row.reject_disposition) as MemoRecord["rejectDisposition"],
    revisionNo: row.revision_no,
    revisionSubmittedAt: row.revision_submitted_at ? toBangkokDisplayTimestamp(row.revision_submitted_at) : undefined,
    revisionNote: optional(row.revision_note),
    priceComparisons: parseJsonArray<PriceComparison>(row.price_comparisons_json),
    selectedVendorId: optional(row.selected_vendor_id),
    selectedVendorReason: optional(row.selected_vendor_reason),
    priceAdjustmentReason: optional(row.price_adjustment_reason),
    requestItems: parseJsonArray<RequestItem>(row.request_items_json),
    readRecipients: parseJsonArray<string>(row.read_recipients_json),
    readActions: serializeReadActions(readActions),
    createdAt: toBangkokDisplayTimestamp(row.created_at),
    updatedAt: toBangkokDisplayTimestamp(row.updated_at),
  };
}

export function toBangkokDisplayTimestamp(value: DbDate): string {
  const date = value instanceof Date
    ? value
    : new Date(value.replace(" ", "T") + "Z");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`;
}

function serializeReadActions(rows: ReadActionDbRow[]): ReadAction[] | undefined {
  if (rows.length === 0) return undefined;
  return rows.map((row) => ({
    recipient: row.recipient_name,
    status: row.status as ReadActionStatus,
    actedAt: row.acted_at ? toBangkokDisplayTimestamp(row.acted_at) : undefined,
    skipReason: optional(row.skip_reason),
  }));
}

function parseJsonArray<T>(value: DbJson): T[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value as T[];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed as T[] : undefined;
}

function toNumber(value: DbNumber): number | undefined {
  if (value === null) return undefined;
  return Number(value);
}

function toBoolean(value: DbBoolean): boolean {
  return value === true || value === 1;
}

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}
