import { NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildSkipAllReadsPayload, type SkipAllReadsBody } from "@/lib/db-memo-write";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as SkipAllReadsBody;
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
