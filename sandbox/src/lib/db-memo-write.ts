import type { MemoRecord, ReadActionStatus } from "./approval";
import { memoToDbSeedRow, toMysqlUtcDateTime, type MemoSeedRow } from "./db-seed";
import { formatTimestamp } from "./format-timestamp";

export type NewMemoValidationResult =
  | { ok: true; memo: MemoRecord }
  | { ok: false; message: string };

// Trust boundary for memo CREATION. POST /api/memos must run every client-supplied
// MemoRecord through this before it reaches memoToDbSeedRow — otherwise a client can
// hand-craft a "record" that is already approved/rejected/mid-workflow and skip the
// entire approval chain. Only server-computed identity (requester, requesterUserId,
// handled by the caller) and this function's forced fields are trusted; everything
// else (department, amount, category, selectedRoute, price comparisons, etc.) is
// legitimate business content the client is expected to author.
export function sanitizeNewMemoInput(
  memo: MemoRecord,
  now: Date = new Date(),
): NewMemoValidationResult {
  if (memo.status !== "draft" && memo.status !== "pending") {
    return { ok: false, message: "status must be draft or pending" };
  }
  const stamp = formatTimestamp(now);
  return {
    ok: true,
    memo: {
      ...memo,
      status: memo.status,
      currentStep: memo.selectedRoute?.[0] ?? "Manager / Top Section",
      workflowState: "Issued",
      revisionNo: 0,
      revisionNote: undefined,
      revisionSubmittedAt: undefined,
      revisions: undefined,
      returnReason: undefined,
      rejectReason: undefined,
      rejectDisposition: undefined,
      mdReviewStatus: undefined,
      mdReviewResumeStep: undefined,
      mdReviewComment: undefined,
      mdReviewActedBy: undefined,
      mdReviewActedAt: undefined,
      createdAt: stamp,
      updatedAt: stamp,
    },
  };
}

export type MemoWritePayload = {
  row: MemoSeedRow;
};

export type NewMemoWorkflowActionRow = {
  revision_no: number;
  action_type: "submit" | "save_draft";
  step_label: null;
  actor_name: string | null;
  result: null;
  reason: null;
  acted_at: string;
  metadata_json: null;
};

export type NewMemoReadActionRow = {
  revision_no: number;
  recipient_name: string;
  status: ReadActionStatus;
  acted_at: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
};

export function buildMemoWritePayload(memo: MemoRecord): MemoWritePayload {
  return {
    row: memoToDbSeedRow(memo),
  };
}

export function buildNewMemoWorkflowAction(row: MemoSeedRow): NewMemoWorkflowActionRow {
  return {
    revision_no: row.revision_no,
    action_type: row.status === "draft" ? "save_draft" : "submit",
    step_label: null,
    actor_name: row.requester_name,
    result: null,
    reason: null,
    acted_at: row.created_at,
    metadata_json: null,
  };
}

export type AdvanceStepBody = {
  stepLabel: string;
  nextCurrentStep: string;
  nextStatus: string;
  nextWorkflowState: string;
  revisionNo: number;
  updatedAt: string;
  actorName: string | null;
};

export type AdvanceStepPayload = {
  memoUpdate: {
    status: string;
    workflow_state: string;
    current_step: string;
    updated_at: string;
  };
  workflowAction: {
    revision_no: number;
    action_type: "check" | "approve";
    step_label: string;
    actor_name: string | null;
    result: "intermediate" | "final";
    acted_at: string;
    metadata_json: null;
  };
};

export function buildAdvanceStepPayload(body: AdvanceStepBody): AdvanceStepPayload {
  const updatedAtUtc = toMysqlUtcDateTime(body.updatedAt);
  const isFinal = body.nextStatus === "approved";
  return {
    memoUpdate: {
      status: body.nextStatus,
      workflow_state: body.nextWorkflowState,
      current_step: body.nextCurrentStep,
      updated_at: updatedAtUtc,
    },
    workflowAction: {
      revision_no: body.revisionNo,
      action_type: isFinal ? "approve" : "check",
      step_label: body.stepLabel,
      actor_name: body.actorName ?? null,
      result: isFinal ? "final" : "intermediate",
      acted_at: updatedAtUtc,
      metadata_json: null,
    },
  };
}

export type ReturnMemoBody = {
  stepLabel: string;
  returnReason: string;
  revisionNo: number;
  updatedAt: string;
  actorName: string | null;
};

export type ReturnMemoPayload = {
  memoUpdate: {
    status: "returned";
    return_reason: string;
    updated_at: string;
  };
  workflowAction: {
    revision_no: number;
    action_type: "return_for_revision";
    step_label: string;
    actor_name: string | null;
    result: null;
    reason: string;
    acted_at: string;
    metadata_json: null;
  };
};

export function buildReturnMemoPayload(body: ReturnMemoBody): ReturnMemoPayload {
  const updatedAtUtc = toMysqlUtcDateTime(body.updatedAt);
  return {
    memoUpdate: {
      status: "returned",
      return_reason: body.returnReason,
      updated_at: updatedAtUtc,
    },
    workflowAction: {
      revision_no: body.revisionNo,
      action_type: "return_for_revision",
      step_label: body.stepLabel,
      actor_name: body.actorName ?? null,
      result: null,
      reason: body.returnReason,
      acted_at: updatedAtUtc,
      metadata_json: null,
    },
  };
}

export type RejectMemoBody = {
  stepLabel: string;
  disposition: "close" | "revision-allowed";
  rejectReason: string;
  revisionNo: number;
  updatedAt: string;
  actorName: string | null;
};

export type RejectMemoPayload = {
  memoUpdate: {
    status: "rejected";
    reject_disposition: "close" | "revision-allowed";
    reject_reason: string;
    updated_at: string;
  };
  workflowAction: {
    revision_no: number;
    action_type: "reject";
    step_label: string;
    actor_name: string | null;
    result: "close" | "revision-allowed";
    reason: string;
    acted_at: string;
    metadata_json: null;
  };
};

export function buildRejectMemoPayload(body: RejectMemoBody): RejectMemoPayload {
  const updatedAtUtc = toMysqlUtcDateTime(body.updatedAt);
  return {
    memoUpdate: {
      status: "rejected",
      reject_disposition: body.disposition,
      reject_reason: body.rejectReason,
      updated_at: updatedAtUtc,
    },
    workflowAction: {
      revision_no: body.revisionNo,
      action_type: "reject",
      step_label: body.stepLabel,
      actor_name: body.actorName ?? null,
      result: body.disposition,
      reason: body.rejectReason,
      acted_at: updatedAtUtc,
      metadata_json: null,
    },
  };
}

export type MarkReadBody = {
  recipient: string;
  revisionNo: number;
  actedAt: string;
  actorName: string | null;
};

export type MarkReadPayload = {
  readActionUpdate: {
    status: "read";
    acted_at: string;
    updated_at: string;
  };
  workflowAction: {
    revision_no: number;
    action_type: "read";
    step_label: null;
    actor_name: string | null;
    result: null;
    reason: null;
    acted_at: string;
    metadata_json: string;
  };
};

export function buildMarkReadPayload(body: MarkReadBody): MarkReadPayload {
  const actedAtUtc = toMysqlUtcDateTime(body.actedAt);
  return {
    readActionUpdate: {
      status: "read",
      acted_at: actedAtUtc,
      updated_at: actedAtUtc,
    },
    workflowAction: {
      revision_no: body.revisionNo,
      action_type: "read",
      step_label: null,
      actor_name: body.actorName ?? null,
      result: null,
      reason: null,
      acted_at: actedAtUtc,
      metadata_json: JSON.stringify({ recipient: body.recipient }),
    },
  };
}

export type SkipAllReadsBody = {
  recipients: string[];
  skipReason: string;
  revisionNo: number;
  actedAt: string;
  actorName: string | null;
};

export type SkipAllReadsPayload = {
  readActionUpdate: {
    status: "skipped";
    skip_reason: string;
    acted_at: string;
    updated_at: string;
  };
  workflowAction: {
    revision_no: number;
    action_type: "skip_read";
    step_label: null;
    actor_name: string | null;
    result: null;
    reason: string;
    acted_at: string;
    metadata_json: string;
  };
};

export function buildSkipAllReadsPayload(body: SkipAllReadsBody): SkipAllReadsPayload {
  const actedAtUtc = toMysqlUtcDateTime(body.actedAt);
  return {
    readActionUpdate: {
      status: "skipped",
      skip_reason: body.skipReason,
      acted_at: actedAtUtc,
      updated_at: actedAtUtc,
    },
    workflowAction: {
      revision_no: body.revisionNo,
      action_type: "skip_read",
      step_label: null,
      actor_name: body.actorName ?? null,
      result: null,
      reason: body.skipReason,
      acted_at: actedAtUtc,
      metadata_json: JSON.stringify({ recipients: body.recipients }),
    },
  };
}

export type ResubmitMemoBody = {
  oldRevisionNo: number;
  source: "return" | "rejection-allowed";
  returnReason: string | null;
  rejectReason: string | null;
  revisionNote: string | null;
  oldSubmittedAt: string;
  snapshotJson: string;
  nextCurrentStep: string;
  readRecipients: string[];
  updatedAt: string;
  actorName: string | null;
  requiresMdReview: boolean;
};

export type ResubmitMemoReadActionRow = {
  revision_no: number;
  recipient_name: string;
  status: "pending";
  acted_at: null;
  skip_reason: null;
  created_at: string;
  updated_at: string;
};

export type ResubmitMemoPayload = {
  memoRevision: {
    revision_no: number;
    source: string;
    return_reason: string | null;
    reject_reason: string | null;
    revision_note: string | null;
    submitted_at: string;
    snapshot_json: string;
    revision_impact: null;
    created_at: string;
  };
  memoUpdate: {
    status: "pending";
    current_step: string;
    workflow_state: "Issued";
    revision_no: number;
    revision_note: string | null;
    revision_submitted_at: string;
    updated_at: string;
    return_reason: null;
    reject_reason: null;
    reject_disposition: null;
    md_review_status: null;
    md_review_resume_step: null;
    md_review_comment: null;
    md_review_acted_by: null;
    md_review_acted_at: null;
  };
  newReadActions: ResubmitMemoReadActionRow[];
  workflowAction: {
    revision_no: number;
    action_type: "resubmit";
    step_label: null;
    actor_name: string | null;
    result: "quick";
    reason: string | null;
    acted_at: string;
    metadata_json: null;
  };
};

export function buildResubmitMemoPayload(body: ResubmitMemoBody): ResubmitMemoPayload {
  const oldSubmittedAtUtc = toMysqlUtcDateTime(body.oldSubmittedAt);
  const updatedAtUtc = toMysqlUtcDateTime(body.updatedAt);
  const newRevisionNo = body.oldRevisionNo + 1;
  return {
    memoRevision: {
      revision_no: body.oldRevisionNo,
      source: body.source,
      return_reason: body.returnReason,
      reject_reason: body.rejectReason,
      revision_note: body.revisionNote,
      submitted_at: oldSubmittedAtUtc,
      snapshot_json: body.snapshotJson,
      revision_impact: null,
      created_at: updatedAtUtc,
    },
    memoUpdate: {
      status: "pending",
      current_step: body.nextCurrentStep,
      workflow_state: "Issued",
      revision_no: newRevisionNo,
      revision_note: body.revisionNote,
      revision_submitted_at: updatedAtUtc,
      updated_at: updatedAtUtc,
      return_reason: null,
      reject_reason: null,
      reject_disposition: null,
      md_review_status: null,
      md_review_resume_step: null,
      md_review_comment: null,
      md_review_acted_by: null,
      md_review_acted_at: null,
    },
    newReadActions: body.readRecipients.map((recipient) => ({
      revision_no: newRevisionNo,
      recipient_name: recipient,
      status: "pending" as const,
      acted_at: null,
      skip_reason: null,
      created_at: updatedAtUtc,
      updated_at: updatedAtUtc,
    })),
    workflowAction: {
      revision_no: newRevisionNo,
      action_type: "resubmit",
      step_label: null,
      actor_name: body.actorName ?? null,
      result: "quick",
      reason: body.revisionNote,
      acted_at: updatedAtUtc,
      metadata_json: null,
    },
  };
}

export type SubmitRevisionBody = {
  oldRevisionNo: number;
  source: "return" | "rejection-allowed";
  returnReason: string | null;
  rejectReason: string | null;
  revisionNote: string | null;
  // Bangkok display-format ("DD Mon YYYY HH:MM") — toMysqlUtcDateTime is applied internally
  oldSubmittedAt: string;
  // Pre-serialized JSON string from buildMemoSnapshot(prevMemo). Caller must use prevMemo,
  // not nextMemo — this is the old content snapshot, not the new form submission.
  snapshotJson: string;
  // From memoToDbSeedRow(nextMemo): timestamps (updated_at, revision_submitted_at) are
  // already UTC ("YYYY-MM-DD HH:MM:SS"). Do NOT call toMysqlUtcDateTime on any field inside.
  nextMemoRow: MemoSeedRow;
  readRecipients: string[];
  actorName: string | null;
};

export type SubmitRevisionPayload = {
  memoRevision: {
    revision_no: number;
    source: string;
    return_reason: string | null;
    reject_reason: string | null;
    revision_note: string | null;
    submitted_at: string;
    snapshot_json: string;
    revision_impact: null;
    created_at: string;
  };
  // nextMemoRow with revision_no forced to oldRevisionNo+1 regardless of nextMemoRow.revision_no.
  // Identity fields (memo_no, requester_name, created_at) are present but must NOT be
  // included in the DB UPDATE — they are immutable after INSERT.
  memoUpdate: MemoSeedRow;
  newReadActions: ResubmitMemoReadActionRow[];
  workflowAction: {
    revision_no: number;
    action_type: "resubmit";
    step_label: null;
    actor_name: string | null;
    result: "edit-and-resubmit";
    reason: string | null;
    acted_at: string;
    metadata_json: null;
  };
};

export function buildSubmitRevisionPayload(body: SubmitRevisionBody): SubmitRevisionPayload {
  const oldSubmittedAtUtc = toMysqlUtcDateTime(body.oldSubmittedAt);
  // nextMemoRow.updated_at is already UTC from memoToDbSeedRow — pass through verbatim.
  const updatedAtUtc = body.nextMemoRow.updated_at;
  // Force newRevisionNo from body.oldRevisionNo to prevent drift if nextMemoRow has a stale value.
  const newRevisionNo = body.oldRevisionNo + 1;
  return {
    memoRevision: {
      revision_no: body.oldRevisionNo,
      source: body.source,
      return_reason: body.returnReason,
      reject_reason: body.rejectReason,
      revision_note: body.revisionNote,
      submitted_at: oldSubmittedAtUtc,
      snapshot_json: body.snapshotJson,
      revision_impact: null,
      created_at: updatedAtUtc,
    },
    memoUpdate: {
      ...body.nextMemoRow,
      revision_no: newRevisionNo,
      md_review_status: null,
      md_review_resume_step: null,
      md_review_comment: null,
      md_review_acted_by: null,
      md_review_acted_at: null,
    },
    newReadActions: body.readRecipients.map((recipient) => ({
      revision_no: newRevisionNo,
      recipient_name: recipient,
      status: "pending" as const,
      acted_at: null,
      skip_reason: null,
      created_at: updatedAtUtc,
      updated_at: updatedAtUtc,
    })),
    workflowAction: {
      revision_no: newRevisionNo,
      action_type: "resubmit",
      step_label: null,
      actor_name: body.actorName ?? null,
      result: "edit-and-resubmit",
      reason: body.revisionNote,
      acted_at: updatedAtUtc,
      metadata_json: null,
    },
  };
}

export type SoftDeleteMemoBody = {
  revisionNo: number;
  // Bangkok display-format ("DD Mon YYYY HH:MM"); converted to UTC internally.
  deletedAt: string;
  actorName: string | null;
  reason: string | null;
};

export type SoftDeleteMemoPayload = {
  // null deleted_at = restore (active); non-null = void.
  memoUpdate: { deleted_at: string | null; updated_at: string };
  workflowAction: {
    revision_no: number;
    action_type: "void" | "restore";
    step_label: null;
    actor_name: string | null;
    result: null;
    reason: string | null;
    acted_at: string;
    metadata_json: null;
  };
};

function buildSoftDeleteLikePayload(
  body: SoftDeleteMemoBody,
  mode: "void" | "restore",
): SoftDeleteMemoPayload {
  const stampUtc = toMysqlUtcDateTime(body.deletedAt);
  return {
    memoUpdate: {
      deleted_at: mode === "void" ? stampUtc : null,
      updated_at: stampUtc,
    },
    workflowAction: {
      revision_no: body.revisionNo,
      action_type: mode,
      step_label: null,
      actor_name: body.actorName ?? null,
      result: null,
      reason: body.reason,
      acted_at: stampUtc,
      metadata_json: null,
    },
  };
}

export function buildSoftDeleteMemoPayload(body: SoftDeleteMemoBody): SoftDeleteMemoPayload {
  return buildSoftDeleteLikePayload(body, "void");
}

export function buildRestoreMemoPayload(body: SoftDeleteMemoBody): SoftDeleteMemoPayload {
  return buildSoftDeleteLikePayload(body, "restore");
}

export function buildNewMemoReadActionRows(memo: MemoRecord): NewMemoReadActionRow[] {
  if (!memo.readActions || memo.readActions.length === 0) return [];
  const revisionNo = memo.revisionNo ?? 0;
  const createdAt = toMysqlUtcDateTime(memo.createdAt);
  const updatedAt = toMysqlUtcDateTime(memo.updatedAt);

  return memo.readActions.map((readAction) => ({
    revision_no: revisionNo,
    recipient_name: readAction.recipient,
    status: readAction.status,
    acted_at: readAction.actedAt ? toMysqlUtcDateTime(readAction.actedAt) : null,
    skip_reason: readAction.skipReason ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
  }));
}
