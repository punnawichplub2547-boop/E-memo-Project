import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildSkipAllReadsPayload, type SkipAllReadsBody } from "@/lib/db-memo-write";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { canActOnStep } from "@/lib/workflow-rules";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & {
  id: number;
  current_step: string;
  status: string;
  revision_no: number;
  department_name: string;
  requester_user_id: number | null;
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
    const body = (await request.json()) as SkipAllReadsBody;
    body.actorName = `${session.firstName} ${session.lastName}`;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<MemoIdRow[]>(
      "SELECT id, current_step, status, revision_no, department_name, requester_user_id FROM memos WHERE memo_no = ? AND deleted_at IS NULL FOR UPDATE",
      [memoNo]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memo = rows[0];

    // Same authority rule as approve/return/reject — canActOnStep is the one place that
    // knows what "the current approver" means. The old inline comparison of
    // session.approvalLevel to current_step could never match a custom route's step
    // ("person:2#6"), so a per-person approver could not skip outstanding reads, and
    // evaluateApproveAction answers 409 while any read is pending: the memo had no way
    // forward at all. It also missed the department scope and the self-requester rule
    // that the approval actions apply.
    if (!canActOnStep(
      {
        id: session.userId,
        roles: session.roles,
        approval_level: session.approvalLevel ?? null,
        department: session.department,
      },
      {
        current_step: memo.current_step,
        department_name: memo.department_name,
        requester_user_id: memo.requester_user_id,
      },
    )) {
      await connection.rollback();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (memo.status !== "pending") {
      await connection.rollback();
      return NextResponse.json({ error: "Memo is not pending" }, { status: 409 });
    }

    // Use DB revision_no — never trust client.
    body.revisionNo = memo.revision_no;

    const memoDbId = memo.id;
    const { readActionUpdate, workflowAction } = buildSkipAllReadsPayload(body);

    if (body.recipients.length > 0) {
      const recipientPlaceholders = body.recipients.map(() => "?").join(", ");
      await connection.execute(
        `UPDATE read_actions SET
           status = ?,
           skip_reason = ?,
           acted_at = ?,
           updated_at = ?
         WHERE memo_id = ?
           AND revision_no = ?
           AND status = 'pending'
           AND recipient_name IN (${recipientPlaceholders})`,
        [
          readActionUpdate.status,
          readActionUpdate.skip_reason,
          readActionUpdate.acted_at,
          readActionUpdate.updated_at,
          memoDbId,
          body.revisionNo,
          ...body.recipients,
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
    console.error("[POST /api/memos/[id]/skip-reads]", error);
    return NextResponse.json({ error: "Unable to skip read actions" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
