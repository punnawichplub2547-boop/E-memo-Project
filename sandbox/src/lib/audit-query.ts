// Pure query-builder for the admin Audit Log view.
//
// Produces the WHERE clause, bound params, and clamped pagination for a query
// over `workflow_step_actions w JOIN memos m`. The SQL string assembly and
// limit/offset clamping live here (unit-testable, no DB) so the route only has
// to splice the pieces into its SELECT/COUNT statements.
//
// Column aliases assumed by the caller's query:
//   w = workflow_step_actions   m = memos

/**
 * Canonical set of action_type values actually written to
 * `workflow_step_actions`. Verified against the real INSERT sites
 * (2026-06-19), NOT the spec's guessed list:
 *   - db-memo-write.ts: submit, save_draft, check, approve,
 *     return_for_revision, reject, read, skip_read, resubmit, void, restore
 *   - workflow-rules.ts: check, approve, return_for_revision, reject
 *   - delete/restore routes persist void/restore
 * `destroy` is NOT an action_type — destroy hard-deletes the audit rows.
 *
 * Filtering by `action` only narrows when the value is one of these; any
 * other value is ignored (no filter applied) so the table is never silently
 * emptied by a typo / stale UI option.
 */
export const KNOWN_ACTION_TYPES = [
  "submit",
  "save_draft",
  "check",
  "approve",
  "return_for_revision",
  "reject",
  "read",
  "skip_read",
  "resubmit",
  "void",
  "restore",
] as const;

export type KnownActionType = (typeof KNOWN_ACTION_TYPES)[number];

const KNOWN_ACTION_SET = new Set<string>(KNOWN_ACTION_TYPES);

export type AuditQueryFilters = {
  /** memo_no substring (LIKE) */
  memo?: string;
  /** exact action_type; ignored unless it is a KNOWN_ACTION_TYPES value */
  action?: string;
  /** actor_name substring (LIKE) */
  actor?: string;
  /** acted_at lower bound (inclusive) */
  from?: string;
  /** acted_at upper bound (inclusive) */
  to?: string;
  /** page size, clamped to 1..100 (default 50) */
  limit?: number;
  /** row offset, clamped to >= 0 (default 50's sibling: 0) */
  offset?: number;
};

export type AuditQuery = {
  /** "" when no filters, otherwise begins with "WHERE " */
  whereSql: string;
  /** bound params aligned with the `?` placeholders in whereSql */
  params: (string | number)[];
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

function clampLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
  const floored = Math.floor(value);
  if (floored < MIN_LIMIT) return DEFAULT_LIMIT;
  if (floored > MAX_LIMIT) return MAX_LIMIT;
  return floored;
}

function clampOffset(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const floored = Math.floor(value);
  return floored < 0 ? 0 : floored;
}

function cleanText(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildAuditQuery(filters: AuditQueryFilters): AuditQuery {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  const memo = cleanText(filters.memo);
  if (memo) {
    clauses.push("m.memo_no LIKE ?");
    params.push(`%${memo}%`);
  }

  const action = cleanText(filters.action);
  if (action && KNOWN_ACTION_SET.has(action)) {
    clauses.push("w.action_type = ?");
    params.push(action);
  }

  const actor = cleanText(filters.actor);
  if (actor) {
    clauses.push("w.actor_name LIKE ?");
    params.push(`%${actor}%`);
  }

  const from = cleanText(filters.from);
  if (from) {
    clauses.push("w.acted_at >= ?");
    params.push(from);
  }

  const to = cleanText(filters.to);
  if (to) {
    // acted_at is DATETIME; a date-only upper bound like "2026-06-30" expands to
    // 00:00:00, which would drop every action recorded later that day. Extend a
    // bare date to end-of-day so the "to" day is inclusive.
    const upperBound = /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to} 23:59:59` : to;
    clauses.push("w.acted_at <= ?");
    params.push(upperBound);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
    limit: clampLimit(filters.limit),
    offset: clampOffset(filters.offset),
  };
}
