// Server-trusted workflow action service. The single path for approve / return /
// reject — web routes and the future Telegram webhook must both go through here.
// Decision logic lives in workflow-rules.ts; this file owns transactions and SQL.
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "./db";
import { parseRoles, type UserRow } from "./db-users";
import {
  evaluateApproveAction,
  evaluateRejectAction,
  evaluateReturnAction,
  type WorkflowActionRow,
  type WorkflowActionSource,
  type WorkflowActorRow,
  type WorkflowEvaluation,
  type WorkflowMemoRow,
} from "./workflow-rules";

export class WorkflowActionError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WorkflowActionError";
    this.status = status;
  }
}

type MemoRowResult = RowDataPacket & WorkflowMemoRow;
type ActorRowResult = RowDataPacket &
  Pick<UserRow, "id" | "first_name" | "last_name" | "roles_json" | "approval_level" | "status">;
type PendingCountRow = RowDataPacket & { pending_count: number };

async function withWorkflowTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const pool = getDbPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function loadMemoForUpdate(
  connection: PoolConnection,
  memoNo: string,
): Promise<WorkflowMemoRow> {
  const [rows] = await connection.execute<MemoRowResult[]>(
    `SELECT id, memo_no, status, current_step, revision_no,
        selected_route_json, deleted_at
   FROM memos WHERE memo_no = ? FOR UPDATE`,
    [memoNo],
  );
  if (rows.length === 0) {
    throw new WorkflowActionError(404, "Memo not found");
  }
  return rows[0];
}

async function loadActor(
  connection: PoolConnection,
  actorUserId: number,
): Promise<WorkflowActorRow> {
  const [rows] = await connection.execute<ActorRowResult[]>(
    `SELECT id, first_name, last_name, roles_json, approval_level, status
   FROM users WHERE id = ? LIMIT 1`,
    [actorUserId],
  );
  const user = rows[0];
  if (!user) {
    throw new WorkflowActionError(403, "Forbidden");
  }
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    roles: parseRoles(user.roles_json),
    approval_level: user.approval_level,
    status: user.status,
  };
}

async function countPendingReads(
  connection: PoolConnection,
  memoId: number,
  revisionNo: number,
): Promise<number> {
  const [rows] = await connection.execute<PendingCountRow[]>(
    `SELECT COUNT(*) AS pending_count FROM read_actions
     WHERE memo_id = ? AND revision_no = ? AND status = 'pending'`,
    [memoId, revisionNo],
  );
  return Number(rows[0]?.pending_count ?? 0);
}

function unwrap<T>(evaluation: WorkflowEvaluation<T>): T {
  if (!evaluation.ok) {
    throw new WorkflowActionError(evaluation.status, evaluation.message);
  }
  return evaluation.payload;
}

async function insertWorkflowAction(
  connection: PoolConnection,
  memoId: number,
  action: WorkflowActionRow,
): Promise<void> {
  await connection.execute(
    `INSERT INTO workflow_step_actions (
       memo_id, revision_no, action_type, step_label, actor_name,
       result, reason, acted_at, metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      memoId,
      action.revision_no,
      action.action_type,
      action.step_label,
      action.actor_name,
      action.result,
      action.reason,
      action.acted_at,
      action.metadata_json,
    ],
  );
}

export async function approveMemoAction(input: {
  memoNo: string;
  actorUserId: number;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  // Capture once before the transaction so acted_at and updated_at are identical.
  const now = new Date();
  return withWorkflowTransaction(async (connection) => {
    const memo = await loadMemoForUpdate(connection, input.memoNo);
    const actor = await loadActor(connection, input.actorUserId);
    const pendingReadCount = await countPendingReads(connection, memo.id, memo.revision_no);
    const { memoUpdate, workflowAction } = unwrap(
      evaluateApproveAction({
        memo,
        actor,
        pendingReadCount,
        source: input.source,
        metadata: input.metadata,
        now,
      }),
    );

    await connection.execute(
      `UPDATE memos SET
         current_step = ?,
         workflow_state = ?,
         status = ?,
         updated_at = ?
       WHERE id = ?`,
      [
        memoUpdate.current_step,
        memoUpdate.workflow_state,
        memoUpdate.status,
        memoUpdate.updated_at,
        memo.id,
      ],
    );
    await insertWorkflowAction(connection, memo.id, workflowAction);
    return { ok: true as const };
  });
}

export async function returnMemoAction(input: {
  memoNo: string;
  actorUserId: number;
  reason: string;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  // Capture once before the transaction so acted_at and updated_at are identical.
  const now = new Date();
  return withWorkflowTransaction(async (connection) => {
    const memo = await loadMemoForUpdate(connection, input.memoNo);
    const actor = await loadActor(connection, input.actorUserId);
    const { memoUpdate, workflowAction } = unwrap(
      evaluateReturnAction({
        memo,
        actor,
        reason: input.reason,
        source: input.source,
        metadata: input.metadata,
        now,
      }),
    );

    await connection.execute(
      `UPDATE memos SET
         status = ?,
         return_reason = ?,
         updated_at = ?
       WHERE id = ?`,
      [memoUpdate.status, memoUpdate.return_reason, memoUpdate.updated_at, memo.id],
    );
    await insertWorkflowAction(connection, memo.id, workflowAction);
    return { ok: true as const };
  });
}

export async function rejectMemoAction(input: {
  memoNo: string;
  actorUserId: number;
  disposition: "close" | "revision-allowed";
  reason: string;
  source: WorkflowActionSource;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  // Capture once before the transaction so acted_at and updated_at are identical.
  const now = new Date();
  return withWorkflowTransaction(async (connection) => {
    const memo = await loadMemoForUpdate(connection, input.memoNo);
    const actor = await loadActor(connection, input.actorUserId);
    const { memoUpdate, workflowAction } = unwrap(
      evaluateRejectAction({
        memo,
        actor,
        disposition: input.disposition,
        reason: input.reason,
        source: input.source,
        metadata: input.metadata,
        now,
      }),
    );

    await connection.execute(
      `UPDATE memos SET
         status = ?,
         reject_disposition = ?,
         reject_reason = ?,
         updated_at = ?
       WHERE id = ?`,
      [
        memoUpdate.status,
        memoUpdate.reject_disposition,
        memoUpdate.reject_reason,
        memoUpdate.updated_at,
        memo.id,
      ],
    );
    await insertWorkflowAction(connection, memo.id, workflowAction);
    return { ok: true as const };
  });
}
