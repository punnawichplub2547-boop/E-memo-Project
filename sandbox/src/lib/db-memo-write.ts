import type { MemoRecord, ReadActionStatus } from "./approval";
import { memoToDbSeedRow, toMysqlUtcDateTime, type MemoSeedRow } from "./db-seed";

export type MemoWritePayload = {
  row: MemoSeedRow;
};

export type NewMemoWorkflowActionRow = {
  revision_no: number;
  action_type: "submit" | "save_draft";
  step_label: null;
  actor_name: null;
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
    actor_name: null,
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
    actor_name: null;
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
      actor_name: null,
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
    actor_name: null;
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
      actor_name: null,
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
    actor_name: null;
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
      actor_name: null,
      result: body.disposition,
      reason: body.rejectReason,
      acted_at: updatedAtUtc,
      metadata_json: null,
    },
  };
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
