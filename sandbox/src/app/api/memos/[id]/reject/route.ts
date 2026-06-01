import { NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildRejectMemoPayload, type RejectMemoBody } from "@/lib/db-memo-write";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as RejectMemoBody;
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
    const { memoUpdate, workflowAction } = buildRejectMemoPayload(body);

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
        memoDbId,
      ]
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
    console.error("[POST /api/memos/[id]/reject]", error);
    return NextResponse.json({ error: "Unable to reject memo" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
