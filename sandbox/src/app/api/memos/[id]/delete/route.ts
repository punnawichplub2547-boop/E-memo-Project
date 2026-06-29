import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { buildSoftDeleteMemoPayload, type SoftDeleteMemoBody } from "@/lib/db-memo-write";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };

// Soft-delete (void) a memo: sets memos.deleted_at and appends a "void" audit row.
// The memo row and all its workflow_step_actions / read_actions / revisions are preserved.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actorName = `${session.firstName} ${session.lastName}`.trim();
  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as SoftDeleteMemoBody;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<MemoIdRow[]>(
      "SELECT id FROM memos WHERE memo_no = ? FOR UPDATE",
      [memoNo]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memoDbId = rows[0].id;
    // Trust the session for the audit actor, never a client-supplied actorName.
    const { memoUpdate, workflowAction } = buildSoftDeleteMemoPayload({ ...body, actorName });

    await connection.execute(
      "UPDATE memos SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [memoUpdate.deleted_at, memoUpdate.updated_at, memoDbId]
    );

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
    console.error("[POST /api/memos/[id]/delete]", error);
    return NextResponse.json({ error: "Unable to void memo" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
