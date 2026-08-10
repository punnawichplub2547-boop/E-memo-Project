// Pure workflow rules for server-trusted approve/return/reject actions.
// No DB imports — everything here is unit-testable without MySQL.
// Transactional orchestration lives in workflow-actions.ts.

import { isCustomRoute, parseCustomStepKey } from "./custom-route";

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
  department_name: string;
  requester_user_id: number | null;
  requires_md_review: boolean;
  md_review_status: "pending" | "completed" | "escalated" | null;
  md_review_resume_step: string | null;
};

// Actor shape after roles_json has been parsed (see workflow-actions.ts loadActor).
export type WorkflowActorRow = {
  id: number;
  first_name: string;
  last_name: string;
  roles: string[];
  approval_level: string | null;
  department: string;
  status: "pending" | "active" | "suspended";
};

// A non-admin actor can never act on their own memo — approve/return/reject via
// canActOnStep below, or MD-review via evaluateReviewAction further down — even
// when their approval_level/tier happens to match the memo's current step (e.g.
// a department Manager submitting their own memo, or an MD submitting a memo
// that requires MD review). requester_user_id null (legacy/seed memo with no
// FK) is never treated as a self-match.
function isSelfRequester(
  actor: Pick<WorkflowActorRow, "id" | "roles">,
  memo: Pick<WorkflowMemoRow, "requester_user_id">,
): boolean {
  if (actor.roles.includes("admin")) return false;
  return memo.requester_user_id !== null && memo.requester_user_id === actor.id;
}

// Manager / Top Section is department-scoped — memo-visibility.ts already limits
// what a Manager can SEE to their own department. Action permission must match,
// or a Manager could approve/return/reject a memo from a department they can't
// even see in their queue. GM and MD stay global (no department restriction).
export function canActOnStep(
  actor: Pick<WorkflowActorRow, "id" | "roles" | "approval_level" | "department">,
  memo: Pick<WorkflowMemoRow, "current_step" | "department_name" | "requester_user_id">,
): boolean {
  if (actor.roles.includes("admin")) return true;
  if (isSelfRequester(actor, memo)) return false;

  // Custom per-person route: the step names exactly one user, so identity is the
  // whole permission check. approval_level and department are deliberately NOT
  // consulted — the requester picked this individual, not a tier or a department.
  const customStep = parseCustomStepKey(memo.current_step);
  if (customStep) return customStep.userId === actor.id;

  if (actor.approval_level === null || actor.approval_level !== memo.current_step) return false;
  // Supervisor and Manager / Top Section are both department-scoped: every
  // department has its own Supervisor/Manager sharing the same label, so action
  // permission must be pinned to the actor's own department (memo-visibility.ts
  // applies the identical scope to what they can SEE). GM and MD stay global.
  if (actor.approval_level === "Manager / Top Section" || actor.approval_level === "Supervisor") {
    return actor.department === memo.department_name;
  }
  return true;
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
  if (!route) return { ok: false, message: "เมโมนี้ไม่มีเส้นทางอนุมัติที่ถูกต้อง" };
  const index = route.indexOf(currentStep);
  if (index === -1) {
    return { ok: false, message: "ขั้นตอนปัจจุบันไม่อยู่ในเส้นทางอนุมัติ" };
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
    return { ok: false, status: 403, message: "บัญชีผู้ใช้ไม่ได้ใช้งานอยู่" };
  }
  if (memo.deleted_at !== null) {
    return { ok: false, status: 409, message: "เมโมนี้ถูกยกเลิกแล้ว" };
  }
  if (memo.status !== "pending") {
    return { ok: false, status: 409, message: "เมโมนี้ไม่ได้อยู่ในสถานะรอดำเนินการ" };
  }
  if (memo.md_review_status === "pending") {
    return { ok: false, status: 409, message: "รอการพิจารณาของ MD ก่อน" };
  }
  if (!canActOnStep(actor, memo)) {
    return { ok: false, status: 403, message: "คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้" };
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

// The step whose completion triggers the blocking MD Review gate.
//   - level route  : "Manager / Top Section" — the mandatory first check (unchanged)
//   - custom route : the first person the requester picked — the equivalent
//                    "first check completed" point (Q22: the gate stays, only the
//                    choice of approvers is free)
function mdReviewGateStep(selectedRouteJson: unknown): string {
  const route = parseRouteJson(selectedRouteJson);
  if (route && isCustomRoute(route)) return route[0];
  return "Manager / Top Section";
}

export type ApproveActionPayload = {
  memoUpdate: {
    status: "pending" | "approved";
    workflow_state: "Checked" | "Approved";
    current_step: string;
    updated_at: string;
    md_review_status: "pending" | null;
    md_review_resume_step: string | null;
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
    return { ok: false, status: 409, message: "ยังมีผู้รับทราบที่ยังไม่ได้กดรับทราบ" };
  }
  const next = calculateNextStep(input.memo.selected_route_json, input.memo.current_step);
  if (!next.ok) return { ok: false, status: 422, message: next.message };

  const actedAt = nowMysqlUtcDateTime(input.now);

  // MD Review gate: right after the Manager/Top Section check completes, if the
  // memo requires MD review and hasn't been reviewed yet, park current_step at
  // "Managing Director" and stash the real next step instead of advancing there
  // directly. If the route would already have ended at Manager (no-op case),
  // stash "Managing Director" itself so the review resolution auto-finalizes
  // (merge MD_REVIEW+APPROVE per spec §6.5).
  const needsReviewStash =
    input.memo.current_step === mdReviewGateStep(input.memo.selected_route_json) &&
    input.memo.requires_md_review &&
    input.memo.md_review_status === null;

  if (needsReviewStash) {
    const resumeStep = next.isFinal ? "Managing Director" : next.nextCurrentStep;
    return {
      ok: true,
      payload: {
        memoUpdate: {
          status: "pending",
          workflow_state: "Checked",
          current_step: "Managing Director",
          updated_at: actedAt,
          md_review_status: "pending",
          md_review_resume_step: resumeStep,
        },
        workflowAction: {
          revision_no: input.memo.revision_no,
          action_type: "check",
          step_label: input.memo.current_step,
          actor_name: actorDisplayName(input.actor),
          result: "intermediate",
          reason: null,
          acted_at: actedAt,
          metadata_json: buildActionMetadata(input.source, input.metadata),
        },
      },
    };
  }

  return {
    ok: true,
    payload: {
      memoUpdate: {
        status: next.nextStatus,
        workflow_state: next.nextWorkflowState,
        current_step: next.nextCurrentStep,
        updated_at: actedAt,
        md_review_status: null,
        md_review_resume_step: null,
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
    // The step the memo re-enters on resubmit (null = restart from the first step,
    // the original behaviour). Server-validated in resolveReturnToStep below.
    return_to_step: string | null;
    updated_at: string;
  };
  workflowAction: WorkflowActionRow;
};

// Validate the approver's chosen return destination against the memo's own route.
// Returns null (safe default: resubmit restarts at route[0]) unless the destination
// is a genuine, non-forward step the approver is allowed to pick:
//   - must be a member of selected_route_json                    (real step)
//   - index ≤ index of current_step                             (Q2: no forward pick)
//   - if requires_md_review: index ≤ index of Manager           (Q1: cannot bypass the
//     MD-review gate by resuming past the Manager step)
// Never throws / never blocks the return — an invalid value simply degrades to null.
function resolveReturnToStep(memo: WorkflowMemoRow, returnToStep: string | undefined): string | null {
  if (!returnToStep) return null;
  const route = parseRouteJson(memo.selected_route_json);
  if (!route) return null;
  const targetIndex = route.indexOf(returnToStep);
  const currentIndex = route.indexOf(memo.current_step);
  if (targetIndex === -1 || currentIndex === -1) return null;
  if (targetIndex > currentIndex) return null;
  if (memo.requires_md_review) {
    // Cannot resume past the gate step, or the memo would skip MD review entirely.
    // The anchor is "Manager / Top Section" on a level route and the first picked
    // person on a custom route — same rule, same code path.
    const gateIndex = route.indexOf(mdReviewGateStep(memo.selected_route_json));
    if (gateIndex !== -1 && targetIndex > gateIndex) return null;
  }
  return returnToStep;
}

export function evaluateReturnAction(input: {
  memo: WorkflowMemoRow;
  actor: WorkflowActorRow;
  reason: string;
  returnToStep?: string;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
  now?: Date;
}): WorkflowEvaluation<ReturnActionPayload> {
  const guard = guardActorAndMemo(input.memo, input.actor);
  if (guard) return guard;
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "ต้องระบุเหตุผลในการส่งคืน" };
  }

  const returnToStep = resolveReturnToStep(input.memo, input.returnToStep);
  const actedAt = nowMysqlUtcDateTime(input.now);
  return {
    ok: true,
    payload: {
      memoUpdate: {
        status: "returned",
        return_reason: reason,
        return_to_step: returnToStep,
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
  // Reject is a Manager-and-above power. A Supervisor is a check-only step: they
  // may pass forward or return for revision, but never reject (Q3). Admin bypasses.
  if (!input.actor.roles.includes("admin") && input.actor.approval_level === "Supervisor") {
    return { ok: false, status: 403, message: "Supervisor ไม่มีสิทธิ์ปฏิเสธเมโม" };
  }
  // Q23: in a custom per-person route, only the LAST person (the "อนุมัติ" role)
  // may reject. Everyone before them is a "ตรวจ/เห็นชอบ" step — they can pass the
  // memo forward or return it for revision, but not kill it. Same shape as the
  // Supervisor rule above; enforced here so web and Telegram share it. Admin bypasses.
  if (!input.actor.roles.includes("admin")) {
    const route = parseRouteJson(input.memo.selected_route_json);
    if (route && isCustomRoute(route)) {
      const stepIndex = route.indexOf(input.memo.current_step);
      if (stepIndex !== -1 && stepIndex < route.length - 1) {
        return {
          ok: false,
          status: 403,
          message: "ผู้ตรวจ/เห็นชอบไม่มีสิทธิ์ปฏิเสธเมโม — ทำได้เฉพาะตีกลับให้แก้ไข",
        };
      }
    }
  }
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "ต้องระบุเหตุผลในการปฏิเสธ" };
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

export type ReviewResponse =
  | "acknowledged_no_objection"
  | "comment"
  | "request_revision"
  | "escalate_to_md_approval";

export type ReviewActionPayload =
  | {
      memoUpdate: {
        status: "pending";
        workflow_state: "Checked";
        current_step: string;
        md_review_status: "completed";
        md_review_comment: string | null;
        updated_at: string;
      };
      workflowAction: WorkflowActionRow;
    }
  | {
      memoUpdate: {
        status: "approved";
        workflow_state: "Approved";
        current_step: "Managing Director";
        md_review_status: "completed" | "escalated";
        md_review_comment: string | null;
        updated_at: string;
      };
      workflowAction: WorkflowActionRow;
    }
  | {
      memoUpdate: {
        status: "returned";
        return_reason: string;
        md_review_status: "completed";
        updated_at: string;
      };
      workflowAction: WorkflowActionRow;
    };

export function evaluateReviewAction(input: {
  memo: WorkflowMemoRow;
  actor: WorkflowActorRow;
  response: ReviewResponse;
  comment?: string;
  reason?: string;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
  now?: Date;
}): WorkflowEvaluation<ReviewActionPayload> {
  if (input.actor.status !== "active") {
    return { ok: false, status: 403, message: "บัญชีผู้ใช้ไม่ได้ใช้งานอยู่" };
  }
  if (input.memo.deleted_at !== null) {
    return { ok: false, status: 409, message: "เมโมนี้ถูกยกเลิกแล้ว" };
  }
  if (input.memo.md_review_status !== "pending") {
    return { ok: false, status: 409, message: "เมโมนี้ไม่มีการรอพิจารณาจาก MD อยู่" };
  }
  if (isSelfRequester(input.actor, input.memo)) {
    return { ok: false, status: 403, message: "คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้" };
  }
  const isMdOrAdmin =
    input.actor.roles.includes("admin") || input.actor.approval_level === "Managing Director";
  if (!isMdOrAdmin) {
    return { ok: false, status: 403, message: "มีเฉพาะ Managing Director เท่านั้นที่ดำเนินการกับการพิจารณานี้ได้" };
  }

  const actedAt = nowMysqlUtcDateTime(input.now);
  const baseWorkflowAction = {
    revision_no: input.memo.revision_no,
    action_type: "review" as const,
    step_label: input.memo.current_step,
    actor_name: actorDisplayName(input.actor),
    acted_at: actedAt,
    metadata_json: buildActionMetadata(input.source, input.metadata),
  };

  if (input.response === "request_revision") {
    const reason = input.reason?.trim();
    if (!reason) {
      return { ok: false, status: 400, message: "ต้องระบุเหตุผลเมื่อขอแก้ไข" };
    }
    return {
      ok: true,
      payload: {
        memoUpdate: {
          status: "returned",
          return_reason: reason,
          md_review_status: "completed",
          updated_at: actedAt,
        },
        workflowAction: {
          ...baseWorkflowAction,
          result: "request_revision",
          reason,
        },
      },
    };
  }

  if (input.response === "escalate_to_md_approval") {
    return {
      ok: true,
      payload: {
        memoUpdate: {
          status: "approved",
          workflow_state: "Approved",
          current_step: "Managing Director",
          md_review_status: "escalated",
          md_review_comment: input.comment?.trim() || null,
          updated_at: actedAt,
        },
        workflowAction: {
          ...baseWorkflowAction,
          result: "escalate_to_md_approval",
          reason: input.comment?.trim() || null,
        },
      },
    };
  }

  // acknowledged_no_objection or comment: resume at the stashed step. If the
  // stashed step is Managing Director itself, this response also finalizes
  // the memo — the spec's "merge MD_REVIEW+APPROVE into one action" rule.
  const resumeStep = input.memo.md_review_resume_step ?? "Managing Director";
  const comment = input.response === "comment" ? input.comment?.trim() || null : null;

  if (resumeStep === "Managing Director") {
    return {
      ok: true,
      payload: {
        memoUpdate: {
          status: "approved",
          workflow_state: "Approved",
          current_step: "Managing Director",
          md_review_status: "completed",
          md_review_comment: comment,
          updated_at: actedAt,
        },
        workflowAction: {
          ...baseWorkflowAction,
          result: input.response,
          reason: comment,
        },
      },
    };
  }

  return {
    ok: true,
    payload: {
      memoUpdate: {
        status: "pending",
        workflow_state: "Checked",
        current_step: resumeStep,
        md_review_status: "completed",
        md_review_comment: comment,
        updated_at: actedAt,
      },
      workflowAction: {
        ...baseWorkflowAction,
        result: input.response,
        reason: comment,
      },
    },
  };
}
