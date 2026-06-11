// Pure workflow rules for server-trusted approve/return/reject actions.
// No DB imports — everything here is unit-testable without MySQL.
// Transactional orchestration lives in workflow-actions.ts.

export type WorkflowActionSource = "web" | "telegram";

// Subset of a `memos` row needed for workflow decisions (SELECT * FOR UPDATE result).
export type WorkflowMemoRow = {
  id: number;
  memo_no: string;
  status: string;
  current_step: string;
  revision_no: number;
  selected_route_json: unknown;
  deleted_at: string | Date | null;
};

// Actor shape after roles_json has been parsed (see workflow-actions.ts loadActor).
export type WorkflowActorRow = {
  id: number;
  first_name: string;
  last_name: string;
  roles: string[];
  approval_level: string | null;
  status: string;
};

export function canActOnStep(
  actor: Pick<WorkflowActorRow, "roles" | "approval_level">,
  currentStep: string,
): boolean {
  if (actor.roles.includes("admin")) return true;
  return actor.approval_level !== null && actor.approval_level === currentStep;
}

export function actorDisplayName(
  actor: Pick<WorkflowActorRow, "first_name" | "last_name">,
): string {
  return `${actor.first_name} ${actor.last_name}`.trim();
}

export function parseRouteJson(value: unknown): string[] | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  if (!parsed.every((step) => typeof step === "string" && step.length > 0)) return null;
  return parsed;
}

export type NextStepResult =
  | {
      ok: true;
      isFinal: false;
      nextCurrentStep: string;
      nextStatus: "pending";
      nextWorkflowState: "Checked";
    }
  | {
      ok: true;
      isFinal: true;
      nextCurrentStep: string;
      nextStatus: "approved";
      nextWorkflowState: "Approved";
    }
  | { ok: false; message: string };

export function calculateNextStep(
  selectedRouteJson: unknown,
  currentStep: string,
): NextStepResult {
  const route = parseRouteJson(selectedRouteJson);
  if (!route) return { ok: false, message: "Memo has no valid approval route" };
  const index = route.indexOf(currentStep);
  if (index === -1) {
    return { ok: false, message: "Current step is not in the approval route" };
  }
  if (index === route.length - 1) {
    return {
      ok: true,
      isFinal: true,
      nextCurrentStep: currentStep,
      nextStatus: "approved",
      nextWorkflowState: "Approved",
    };
  }
  return {
    ok: true,
    isFinal: false,
    nextCurrentStep: route[index + 1],
    nextStatus: "pending",
    nextWorkflowState: "Checked",
  };
}

export function buildActionMetadata(
  source: WorkflowActionSource,
  metadata?: Record<string, unknown>,
): string {
  return JSON.stringify({ ...(metadata ?? {}), source });
}

export function nowMysqlUtcDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
