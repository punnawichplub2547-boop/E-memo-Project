import type { RowDataPacket } from "mysql2";
import { getDbPool } from "./db";
import type {
  ApprovalCategory,
  ApprovalLevel,
  ApprovalRouteMode,
  BudgetStatus,
  MemoRecord,
  MemoRevision,
  MemoSnapshot,
  MemoStatus,
  PriceComparison,
  MemoAttachment,
  ReadAction,
  ReadActionStatus,
  RequestItem,
  WorkflowState,
} from "./approval";

type DbDate = string | Date;
type DbBoolean = boolean | 0 | 1;
type DbJson = string | unknown[] | null;
type DbJsonObject = string | Record<string, unknown>;
type DbNumber = string | number | null;

export type MemoDbRow = {
  id: number;
  memo_no: string;
  title: string;
  requester_name: string;
  // Optional: absent on legacy DBs that predate the requester_user_id migration.
  requester_user_id?: number | null;
  department_name: string;
  category: string;
  item_subcategory_id?: number | null;
  item_subcategory_label?: string | null;
  amount: DbNumber;
  budget_status: string | null;
  account_code: string | null;
  budget_plan: DbNumber;
  budget_used: DbNumber;
  description: string | null;
  closing_remark: string | null;
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
  attachments_json?: DbJson;
  created_at: DbDate;
  updated_at: DbDate;
  // Optional: absent on legacy DBs that predate the soft-delete migration.
  deleted_at?: DbDate | null;
};

export type ReadActionDbRow = {
  recipient_name: string;
  status: string;
  acted_at: DbDate | null;
  skip_reason: string | null;
};

export type MemoRevisionDbRow = {
  revision_no: number;
  source: string;
  return_reason: string | null;
  reject_reason: string | null;
  revision_note: string | null;
  submitted_at: DbDate;
  snapshot_json: DbJsonObject;
};

export function serializeMemoRecord(
  row: MemoDbRow,
  readActions: ReadActionDbRow[],
  revisions: MemoRevisionDbRow[] = [],
): MemoRecord {
  return {
    id: row.memo_no,
    title: row.title,
    requester: row.requester_name,
    requesterUserId: row.requester_user_id ?? undefined,
    department: row.department_name,
    category: row.category as ApprovalCategory,
    itemSubcategoryId: row.item_subcategory_id ?? undefined,
    itemSubcategoryLabel: optional(row.item_subcategory_label ?? null),
    amount: toNumber(row.amount) ?? 0,
    budgetStatus: optional(row.budget_status) as BudgetStatus | undefined,
    accountCode: optional(row.account_code),
    budgetPlan: toNumber(row.budget_plan),
    budgetUsed: toNumber(row.budget_used),
    description: optional(row.description),
    closingRemark: optional(row.closing_remark),
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
    attachments: parseJsonArray<MemoAttachment>(row.attachments_json ?? null),
    readActions: serializeReadActions(readActions),
    revisions: serializeMemoRevisions(revisions),
    createdAt: toBangkokDisplayTimestamp(row.created_at),
    updatedAt: toBangkokDisplayTimestamp(row.updated_at),
    deletedAt: row.deleted_at ? toBangkokDisplayTimestamp(row.deleted_at) : undefined,
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

function serializeMemoRevisions(rows: MemoRevisionDbRow[]): MemoRevision[] | undefined {
  if (rows.length === 0) return undefined;
  return rows.map((row) => ({
    revisionNo: row.revision_no,
    source: row.source as MemoRevision["source"],
    returnReason: optional(row.return_reason),
    rejectReason: optional(row.reject_reason),
    revisionNote: optional(row.revision_note),
    submittedAt: toBangkokDisplayTimestamp(row.submitted_at),
    snapshot: parseJsonObject<MemoSnapshot>(row.snapshot_json),
  }));
}

export type WorkflowActionDbRow = {
  revision_no: number;
  action_type: string;
  step_label: string | null;
  actor_name: string | null;
  result: string | null;
  reason: string | null;
  acted_at: DbDate;
  // mysql2 may return JSON columns as a pre-parsed object or as a string
  metadata_json: DbJsonObject | null;
};

export type WorkflowAction = {
  memoNo: string;
  revisionNo: number;
  actionType: string;
  stepLabel: string | null;
  actorName: string | null;
  result: string | null;
  reason: string | null;
  actedAt: string;
  metadata: Record<string, unknown> | null;
};

export function serializeWorkflowAction(
  memoNo: string,
  row: WorkflowActionDbRow,
): WorkflowAction {
  return {
    memoNo,
    revisionNo: row.revision_no,
    actionType: row.action_type,
    stepLabel: row.step_label ?? null,
    actorName: row.actor_name ?? null,
    result: row.result ?? null,
    reason: row.reason ?? null,
    actedAt: toBangkokDisplayTimestamp(row.acted_at),
    metadata: parseWorkflowMetadata(row.metadata_json),
  };
}

function parseWorkflowMetadata(value: DbJsonObject | null): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function parseJsonArray<T>(value: DbJson): T[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value as T[];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed as T[] : undefined;
}

function parseJsonObject<T>(value: DbJsonObject): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
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

/**
 * Loads a single memo by its memo_no (e.g. "EM-2026-001") and serializes it,
 * including its read actions and revisions. Returns null when no row matches.
 *
 * Shared by the attachment routes for per-memo authorization. Mirrors the
 * single-memo load pattern in the export-excel route (SELECT * + read_actions +
 * revisions for the current revision_no), reusing serializeMemoRecord.
 */
export async function loadMemoRecord(memoNo: string): Promise<MemoRecord | null> {
  const pool = getDbPool();
  const [memoRows] = await pool.query<(RowDataPacket & MemoDbRow)[]>(
    "SELECT * FROM memos WHERE memo_no = ? LIMIT 1",
    [memoNo],
  );
  if (memoRows.length === 0) return null;
  const memoRow = memoRows[0];

  const [readRows] = await pool.query<(RowDataPacket & ReadActionDbRow)[]>(
    "SELECT recipient_name, status, acted_at, skip_reason FROM read_actions WHERE memo_id = ? AND revision_no = ? ORDER BY id ASC",
    [memoRow.id, memoRow.revision_no],
  );
  const [revisionRows] = await pool.query<(RowDataPacket & MemoRevisionDbRow)[]>(
    "SELECT revision_no, source, return_reason, reject_reason, revision_note, submitted_at, snapshot_json FROM memo_revisions WHERE memo_id = ? ORDER BY revision_no ASC, id ASC",
    [memoRow.id],
  );

  return serializeMemoRecord(memoRow, readRows, revisionRows);
}
