import { NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildMarkReadPayload, type MarkReadBody } from "@/lib/db-memo-write";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as MarkReadBody;
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
    const { readActionUpdate, workflowAction } = buildMarkReadPayload(body);

    const [updateResult] = await connection.execute<ResultSetHeader>(
      `UPDATE read_actions SET
         status = ?,
         acted_at = ?,
         updated_at = ?
       WHERE memo_id = ?
         AND revision_no = ?
         AND recipient_name = ?`,
      [
        readActionUpdate.status,
        readActionUpdate.acted_at,
        readActionUpdate.updated_at,
        memoDbId,
        body.revisionNo,
        body.recipient,
      ]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Read action not found" }, { status: 404 });
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
    console.error("[POST /api/memos/[id]/read]", error);
    return NextResponse.json({ error: "Unable to mark read action" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
