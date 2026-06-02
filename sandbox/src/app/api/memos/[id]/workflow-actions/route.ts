import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { serializeWorkflowAction, type WorkflowActionDbRow } from "@/lib/db-memos";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };
type WorkflowActionRow = RowDataPacket & WorkflowActionDbRow;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  try {
    const pool = getDbPool();

    // Check memo exists — return 404 for unknown memo_no (e.g. in-memory-only seed memos)
    const [memoRows] = await pool.query<MemoIdRow[]>(
      "SELECT id FROM memos WHERE memo_no = ? LIMIT 1",
      [memoNo]
    );
    if (memoRows.length === 0) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memoDbId = memoRows[0].id;
    const [actionRows] = await pool.query<WorkflowActionRow[]>(
      `SELECT revision_no, action_type, step_label, actor_name,
              result, reason, acted_at, metadata_json
       FROM workflow_step_actions
       WHERE memo_id = ?
       ORDER BY acted_at ASC, id ASC`,
      [memoDbId]
    );

    return NextResponse.json(
      actionRows.map((row) => serializeWorkflowAction(memoNo, row))
    );
  } catch (error) {
    console.error("[GET /api/memos/[id]/workflow-actions]", error);
    return NextResponse.json({ error: "Unable to load workflow actions" }, { status: 500 });
  }
}
