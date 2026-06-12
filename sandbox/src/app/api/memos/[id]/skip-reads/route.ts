import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildSkipAllReadsPayload, type SkipAllReadsBody } from "@/lib/db-memo-write";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number; current_step: string; status: string; revision_no: number };

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
      "SELECT id, current_step, status, revision_no FROM memos WHERE memo_no = ? AND deleted_at IS NULL FOR UPDATE",
      [memoNo]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memo = rows[0];

    const isAdmin = session.roles.includes("admin");
    if (!isAdmin && session.approvalLevel !== memo.current_step) {
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
