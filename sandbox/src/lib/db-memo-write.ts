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
