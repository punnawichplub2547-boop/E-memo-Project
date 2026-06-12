import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildResubmitMemoPayload, type ResubmitMemoBody } from "@/lib/db-memo-write";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & {
  id: number;
  requester_name: string;
  status: string;
  reject_disposition: string | null;
  revision_no: number;
  selected_route_json: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: memoNo } = await params;
  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as ResubmitMemoBody;
    body.actorName = `${session.firstName} ${session.lastName}`;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<MemoIdRow[]>(
      `SELECT id, requester_name, status, reject_disposition, revision_no, selected_route_json
       FROM memos WHERE memo_no = ? AND deleted_at IS NULL FOR UPDATE`,
      [memoNo]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memo = rows[0];

    const isAdmin = session.roles.includes("admin");
    if (!isAdmin && memo.requester_name !== `${session.firstName} ${session.lastName}`) {
      await connection.rollback();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // State machine guard: only returned or rejected+revision-allowed can be resubmitted.
    const canResubmit =
      memo.status === "returned" ||
      (memo.status === "rejected" && memo.reject_disposition === "revision-allowed");
    if (!canResubmit) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo cannot be resubmitted in its current state" }, { status: 409 });
    }

    // Server derives these — never trust client for workflow-critical fields.
    const selectedRoute = JSON.parse(memo.selected_route_json || "[]") as string[];
    body.nextCurrentStep = selectedRoute[0] ?? "Manager / Top Section";
    body.oldRevisionNo = memo.revision_no;

    const memoDbId = memo.id;
    const { memoRevision, memoUpdate, newReadActions, workflowAction } = buildResubmitMemoPayload(body);

    await connection.execute(
      `INSERT INTO memo_revisions (
         memo_id, revision_no, source, return_reason, reject_reason,
         revision_note, submitted_at, snapshot_json, revision_impact, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memoDbId,
        memoRevision.revision_no,
        memoRevision.source,
        memoRevision.return_reason,
        memoRevision.reject_reason,
        memoRevision.revision_note,
        memoRevision.submitted_at,
        memoRevision.snapshot_json,
        memoRevision.revision_impact,
        memoRevision.created_at,
      ]
    );

    await connection.execute(
      `UPDATE memos SET
         status = ?,
         current_step = ?,
         workflow_state = ?,
         revision_no = ?,
         revision_note = ?,
         revision_submitted_at = ?,
         updated_at = ?,
         return_reason = ?,
         reject_reason = ?,
         reject_disposition = ?
       WHERE id = ?`,
      [
        memoUpdate.status,
        memoUpdate.current_step,
        memoUpdate.workflow_state,
        memoUpdate.revision_no,
        memoUpdate.revision_note,
        memoUpdate.revision_submitted_at,
        memoUpdate.updated_at,
        memoUpdate.return_reason,
        memoUpdate.reject_reason,
        memoUpdate.reject_disposition,
        memoDbId,
      ]
    );

    for (const ra of newReadActions) {
      await connection.execute(
        `INSERT INTO read_actions (
           memo_id, revision_no, recipient_name, status, acted_at,
           skip_reason, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memoDbId,
          ra.revision_no,
          ra.recipient_name,
          ra.status,
          ra.acted_at,
          ra.skip_reason,
          ra.created_at,
          ra.updated_at,
        ]
      );
    }

    await connection.execute(
      `INSERT INTO workflow_step_actions (
         memo_id, revision_no, action_type, step_label, actor_name,
         result, reason, acted_at, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memoDbId,
        workflowAction.revision_no,
        workflowAction.action_type,
        workflowAction.step_label,
        workflowAction.actor_name,
        workflowAction.result,
        workflowAction.reason,
        workflowAction.acted_at,
        workflowAction.metadata_json,
      ]
    );

    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[POST /api/memos/[id]/resubmit]", error);
    return NextResponse.json({ error: "Unable to resubmit memo" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
