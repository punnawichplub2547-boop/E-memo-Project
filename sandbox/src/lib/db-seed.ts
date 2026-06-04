import type { MemoRecord, WorkflowState } from "./approval";

type Nullable<T> = T | null;

export type MemoSeedRow = {
  memo_no: string;
  title: string;
  requester_name: string;
  department_name: string;
  category: string;
  amount: number;
  budget_status: Nullable<string>;
  account_code: Nullable<string>;
  budget_plan: Nullable<number>;
  budget_used: Nullable<number>;
  description: Nullable<string>;
  status: string;
  workflow_state: Nullable<string>;
  current_step: string;
  cycle_hours: Nullable<number>;
  recommended_final_approver: Nullable<string>;
  recommended_route_json: Nullable<string>;
  selected_route_json: Nullable<string>;
  route_mode: Nullable<string>;
  route_override_reason: Nullable<string>;
  notify_md: boolean;
  is_price_adjustment: boolean;
  follows_production_plan: boolean;
  is_dead_stock: boolean;
  dept_monthly_over_budget_total: Nullable<number>;
  return_reason: Nullable<string>;
  reject_reason: Nullable<string>;
  reject_disposition: Nullable<string>;
  revision_no: number;
  revision_submitted_at: Nullable<string>;
  revision_note: Nullable<string>;
  price_comparisons_json: Nullable<string>;
  selected_vendor_id: Nullable<string>;
  selected_vendor_reason: Nullable<string>;
  price_adjustment_reason: Nullable<string>;
  request_items_json: Nullable<string>;
  read_recipients_json: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type SeedWorkflowActionRow = {
  revision_no: number;
  action_type: "submit";
  step_label: null;
  actor_name: string | null;
  result: null;
  reason: null;
  acted_at: string;
  metadata_json: null;
};

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export function toMysqlUtcDateTime(displayTimestamp: string): string {
  const match = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2})$/.exec(displayTimestamp);
  if (!match) {
    throw new Error(`Invalid display timestamp: ${displayTimestamp}`);
  }

  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const month = MONTHS[monthText];
  if (month === undefined) {
    throw new Error(`Invalid display timestamp month: ${displayTimestamp}`);
  }

  const utcMillis = Date.UTC(
    Number(yearText),
    month,
    Number(dayText),
    Number(hourText) - 7,
    Number(minuteText),
    0
  );
  const date = new Date(utcMillis);
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join("-") + ` ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:00`;
}

export function memoToDbSeedRow(memo: MemoRecord): MemoSeedRow {
  return {
    memo_no: memo.id,
    title: memo.title,
    requester_name: memo.requester,
    department_name: memo.department,
    category: memo.category,
    amount: memo.amount,
    budget_status: memo.budgetStatus ?? null,
    account_code: memo.accountCode ?? null,
    budget_plan: memo.budgetPlan ?? null,
    budget_used: memo.budgetUsed ?? null,
    description: memo.description ?? null,
    status: memo.status,
    workflow_state: memo.workflowState ?? inferWorkflowState(memo.status),
    current_step: memo.currentStep,
    cycle_hours: memo.cycleHours ?? null,
    recommended_final_approver: memo.recommendedFinalApprover ?? null,
    recommended_route_json: stringifyJson(memo.recommendedRoute),
    selected_route_json: stringifyJson(memo.selectedRoute),
    route_mode: memo.routeMode ?? null,
    route_override_reason: memo.routeOverrideReason ?? null,
    notify_md: memo.notifyMD ?? false,
    is_price_adjustment: memo.isPriceAdjustment ?? false,
    follows_production_plan: memo.followsProductionPlan ?? false,
    is_dead_stock: memo.isDeadStockOrSlowMovement ?? false,
    dept_monthly_over_budget_total: memo.departmentMonthlyOverBudgetTotal ?? null,
    return_reason: memo.returnReason ?? null,
    reject_reason: memo.rejectReason ?? null,
    reject_disposition: memo.rejectDisposition ?? null,
    revision_no: memo.revisionNo ?? 0,
    revision_submitted_at: memo.revisionSubmittedAt ? toMysqlUtcDateTime(memo.revisionSubmittedAt) : null,
    revision_note: memo.revisionNote ?? null,
    price_comparisons_json: stringifyJson(memo.priceComparisons),
    selected_vendor_id: memo.selectedVendorId ?? null,
    selected_vendor_reason: memo.selectedVendorReason ?? null,
    price_adjustment_reason: memo.priceAdjustmentReason ?? null,
    request_items_json: stringifyJson(memo.requestItems),
    read_recipients_json: stringifyJson(memo.readRecipients),
    created_at: toMysqlUtcDateTime(memo.createdAt),
    updated_at: toMysqlUtcDateTime(memo.updatedAt),
  };
}

export function buildSeedWorkflowAction(row: MemoSeedRow): SeedWorkflowActionRow {
  return {
    revision_no: row.revision_no,
    action_type: "submit",
    step_label: null,
    actor_name: row.requester_name,
    result: null,
    reason: null,
    acted_at: row.created_at,
    metadata_json: null,
  };
}

function inferWorkflowState(status: MemoRecord["status"]): WorkflowState {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Issued";
}

function stringifyJson(value: unknown[] | undefined): string | null {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
