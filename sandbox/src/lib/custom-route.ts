// Per-person ("custom") approval routes.
//
// A route stays a plain string[] in memos.selected_route_json — the custom mode
// only changes what the strings mean. A level route holds ApprovalLevel labels
// ("Manager / Top Section"); a custom route holds positional person tokens
// ("person:1#42" = position 1, users.id 42). Keeping the column shape identical
// is what lets calculateNextStep / resolveReturnToStep / return_to_step /
// md_review_resume_step keep working untouched, and lets old memos load as-is.
//
// The token carries the user id on purpose: pure workflow rules can decide
// permission from the step string alone, with no extra lookup.
// This module must stay free of DB and React imports — server, client and Edge
// all import it.

export const CUSTOM_STEP_PREFIX = "person:";

export type CustomStepKey = string;
export type CustomStepRole = "check" | "approve";

/** Display snapshot of one person in a custom route, taken at submit time so a
 *  later rename/transfer cannot rewrite an approved document's history. */
export type CustomApprover = {
  stepKey: string;
  userId: number;
  name: string;
  approvalLevel: string | null;
  department: string | null;
};

const TOKEN_PATTERN = /^person:([1-9]\d*)#([1-9]\d*)$/;

export function buildCustomStepKey(index: number, userId: number): string {
  return `${CUSTOM_STEP_PREFIX}${index}#${userId}`;
}

export function parseCustomStepKey(step: string): { index: number; userId: number } | null {
  if (typeof step !== "string") return null;
  const match = TOKEN_PATTERN.exec(step);
  if (!match) return null;
  return { index: Number(match[1]), userId: Number(match[2]) };
}

export function isCustomStepKey(step: string): boolean {
  return parseCustomStepKey(step) !== null;
}

/** A route is "custom" only when EVERY entry is a token. A mixed route is not a
 *  valid state — treating it as level-mode keeps the old code path in charge. */
export function isCustomRoute(route: readonly string[] | null | undefined): boolean {
  if (!route || route.length === 0) return false;
  return route.every((step) => isCustomStepKey(step));
}

/**
 * Finds the first person token in routes that arrived on a request.
 *
 * A token is an authorization primitive, not a display string: canActOnStep reads
 * the approving user's id straight out of the step text, so whoever writes the token
 * chooses the approver. Only the server may mint one (custom-route-server.ts rebuilds
 * every token from the users table). A token in a request that did NOT resolve to a
 * server-built custom route is therefore forged, and the handler must refuse it —
 * accepting it would name an arbitrary or inactive user as approver, leave route_mode
 * saying "recommended" while the route is per-person, and (for a mixed route) make
 * isCustomRoute false so the Q23 reject rule and the MD review gate stop applying.
 *
 * Entries are typed unknown on purpose: this inspects unvalidated request bodies.
 */
export function findForgedCustomStep(
  ...routes: ReadonlyArray<readonly unknown[] | null | undefined>
): string | null {
  for (const route of routes) {
    if (!Array.isArray(route)) continue;
    for (const step of route) {
      if (typeof step === "string" && isCustomStepKey(step)) return step;
    }
  }
  return null;
}

/** Q4: the last position approves; everyone before it checks/endorses. */
export function customStepRole(index: number, routeLength: number): CustomStepRole {
  return index >= routeLength ? "approve" : "check";
}

export function buildCustomRoute(
  people: ReadonlyArray<{
    userId: number;
    name: string;
    approvalLevel: string | null;
    department: string | null;
  }>,
): { route: string[]; approvers: CustomApprover[] } {
  const approvers = people.map((person, i) => ({
    stepKey: buildCustomStepKey(i + 1, person.userId),
    userId: person.userId,
    name: person.name,
    approvalLevel: person.approvalLevel,
    department: person.department,
  }));
  return { route: approvers.map((a) => a.stepKey), approvers };
}

export function parseCustomRouteJson(value: unknown): CustomApprover[] | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const rows: CustomApprover[] = [];
  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.stepKey !== "string" || typeof row.userId !== "number") return null;
    if (typeof row.name !== "string") return null;
    rows.push({
      stepKey: row.stepKey,
      userId: row.userId,
      name: row.name,
      approvalLevel: typeof row.approvalLevel === "string" ? row.approvalLevel : null,
      department: typeof row.department === "string" ? row.department : null,
    });
  }
  return rows;
}

export function findCustomApprover(
  approvers: readonly CustomApprover[] | null | undefined,
  stepKey: string,
): CustomApprover | null {
  if (!approvers) return null;
  return approvers.find((a) => a.stepKey === stepKey) ?? null;
}

const ROLE_LABEL: Record<CustomStepRole, string> = {
  check: "ตรวจ/เห็นชอบ",
  approve: "อนุมัติ",
};

/** Human label for a step. Non-token steps pass through unchanged so callers can
 *  use this for every step in any route without branching. */
export function describeCustomStep(
  step: string,
  approvers: readonly CustomApprover[] | null | undefined,
  routeLength?: number,
): string {
  const parsed = parseCustomStepKey(step);
  if (!parsed) return step;
  const approver = findCustomApprover(approvers, step);
  if (!approver) return `ผู้อนุมัติลำดับที่ ${parsed.index}`;
  const role = ROLE_LABEL[customStepRole(parsed.index, routeLength ?? approvers?.length ?? parsed.index)];
  return [approver.name, approver.approvalLevel, role].filter(Boolean).join(" · ");
}

/** One readable line for a whole route ("สมชาย ใจดี -> สุภาพร เจริญสุข").
 *  Every screen and export that prints a route must go through this: a route is a
 *  list of storage tokens, and joining it raw puts "person:2#6" in front of a user.
 *  Level routes pass through unchanged, so callers never branch on the route mode. */
export function describeRouteSummary(
  route: readonly string[] | null | undefined,
  approvers: readonly CustomApprover[] | null | undefined,
): string {
  if (!route || route.length === 0) return "";
  return route.map((step) => describeCustomStepShort(step, approvers)).join(" -> ");
}

/** Name-only label for compact cells (list rows, table columns, tier pills) where
 *  the full "name · level · role" string would be truncated to uselessness.
 *  Same fallbacks as describeCustomStep: positional label when the snapshot is
 *  missing, and non-token steps pass through unchanged. */
export function describeCustomStepShort(
  step: string,
  approvers: readonly CustomApprover[] | null | undefined,
): string {
  const parsed = parseCustomStepKey(step);
  if (!parsed) return step;
  return findCustomApprover(approvers, step)?.name ?? `ผู้อนุมัติลำดับที่ ${parsed.index}`;
}
