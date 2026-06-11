// Pure workflow rules for server-trusted approve/return/reject actions.
// No DB imports — everything here is unit-testable without MySQL.
// Transactional orchestration lives in workflow-actions.ts.

export type WorkflowActionSource = "web" | "telegram";

// Subset of a `memos` row needed for workflow decisions (SELECT * FOR UPDATE result).
export type WorkflowMemoRow = {
  id: number;
  memo_no: string;
  status: "draft" | "pending" | "approved" | "rejected" | "returned";
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
  status: "pending" | "active" | "suspended";
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

export type WorkflowEvaluation<T> =
  | { ok: true; payload: T }
  | { ok: false; status: number; message: string };

// Shared guards for approve / return / reject. Returns null when the actor may act.
function guardActorAndMemo(
  memo: WorkflowMemoRow,
  actor: WorkflowActorRow,
): { ok: false; status: number; message: string } | null {
  if (actor.status !== "active") {
    return { ok: false, status: 403, message: "User account is not active" };
  }
  if (memo.deleted_at !== null) {
    return { ok: false, status: 409, message: "Memo has been voided" };
  }
  if (memo.status !== "pending") {
    return { ok: false, status: 409, message: "Memo is not pending" };
  }
  if (!canActOnStep(actor, memo.current_step)) {
    return { ok: false, status: 403, message: "You do not have permission for this step" };
  }
  return null;
}

export type WorkflowActionRow = {
  revision_no: number;
  action_type: string;
  step_label: string | null;
  actor_name: string;
  result: string | null;
  reason: string | null;
  acted_at: string;
  metadata_json: string;
};

export type ApproveActionPayload = {
  memoUpdate: {
    status: "pending" | "approved";
    workflow_state: "Checked" | "Approved";
    current_step: string;
    updated_at: string;
  };
  workflowAction: WorkflowActionRow;
};

export function evaluateApproveAction(input: {
  memo: WorkflowMemoRow;
  actor: WorkflowActorRow;
  pendingReadCount: number;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
  now?: Date;
}): WorkflowEvaluation<ApproveActionPayload> {
  const guard = guardActorAndMemo(input.memo, input.actor);
  if (guard) return guard;
  if (input.pendingReadCount > 0) {
    return { ok: false, status: 409, message: "Pending read acknowledgements remain" };
  }
  const next = calculateNextStep(input.memo.selected_route_json, input.memo.current_step);
  if (!next.ok) return { ok: false, status: 422, message: next.message };

  const actedAt = nowMysqlUtcDateTime(input.now);
  return {
    ok: true,
    payload: {
      memoUpdate: {
        status: next.nextStatus,
        workflow_state: next.nextWorkflowState,
        current_step: next.nextCurrentStep,
        updated_at: actedAt,
      },
      workflowAction: {
        revision_no: input.memo.revision_no,
        action_type: next.isFinal ? "approve" : "check",
        step_label: input.memo.current_step,
        actor_name: actorDisplayName(input.actor),
        result: next.isFinal ? "final" : "intermediate",
        reason: null,
        acted_at: actedAt,
        metadata_json: buildActionMetadata(input.source, input.metadata),
      },
    },
  };
}

export type ReturnActionPayload = {
  memoUpdate: {
    status: "returned";
    return_reason: string;
    updated_at: string;
  };
  workflowAction: WorkflowActionRow;
};

export function evaluateReturnAction(input: {
  memo: WorkflowMemoRow;
  actor: WorkflowActorRow;
  reason: string;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
  now?: Date;
}): WorkflowEvaluation<ReturnActionPayload> {
  const guard = guardActorAndMemo(input.memo, input.actor);
  if (guard) return guard;
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "returnReason is required" };
  }

  const actedAt = nowMysqlUtcDateTime(input.now);
  return {
    ok: true,
    payload: {
      memoUpdate: {
        status: "returned",
        return_reason: reason,
        updated_at: actedAt,
      },
      workflowAction: {
        revision_no: input.memo.revision_no,
        action_type: "return_for_revision",
        step_label: input.memo.current_step,
        actor_name: actorDisplayName(input.actor),
        result: null,
        reason,
        acted_at: actedAt,
        metadata_json: buildActionMetadata(input.source, input.metadata),
      },
    },
  };
}

export type RejectActionPayload = {
  memoUpdate: {
    status: "rejected";
    reject_disposition: "close" | "revision-allowed";
    reject_reason: string;
    updated_at: string;
  };
  workflowAction: WorkflowActionRow;
};

export function evaluateRejectAction(input: {
  memo: WorkflowMemoRow;
  actor: WorkflowActorRow;
  disposition: "close" | "revision-allowed";
  reason: string;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
  now?: Date;
}): WorkflowEvaluation<RejectActionPayload> {
  const guard = guardActorAndMemo(input.memo, input.actor);
  if (guard) return guard;
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "rejectReason is required" };
  }

  const actedAt = nowMysqlUtcDateTime(input.now);
  return {
    ok: true,
    payload: {
      memoUpdate: {
        status: "rejected",
        reject_disposition: input.disposition,
        reject_reason: reason,
        updated_at: actedAt,
      },
      workflowAction: {
        revision_no: input.memo.revision_no,
        action_type: "reject",
        step_label: input.memo.current_step,
        actor_name: actorDisplayName(input.actor),
        result: input.disposition,
        reason,
        acted_at: actedAt,
        metadata_json: buildActionMetadata(input.source, input.metadata),
      },
    },
  };
}
