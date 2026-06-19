import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import {
  serializeWorkflowAction,
  loadMemoRecord,
  type WorkflowActionDbRow,
} from "@/lib/db-memos";
import { isMemoVisibleTo } from "@/lib/memo-visibility";

export const dynamic = "force-dynamic";

type WorkflowActionRow = RowDataPacket & WorkflowActionDbRow;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;

  // Auth: must be signed in, and the memo must be visible to this session.
  // Mirrors the attachment-access control theme — audit trail is per-memo
  // sensitive, so list visibility governs who can read its action history.
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memo = await loadMemoRecord(memoNo);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (!isMemoVisibleTo(memo, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Join through memos by memo_no so we don't re-resolve the numeric id
    // separately (loadMemoRecord already confirmed the memo exists above).
    const pool = getDbPool();
    const [actionRows] = await pool.query<WorkflowActionRow[]>(
      `SELECT w.revision_no, w.action_type, w.step_label, w.actor_name,
              w.result, w.reason, w.acted_at, w.metadata_json
       FROM workflow_step_actions w
       JOIN memos m ON m.id = w.memo_id
       WHERE m.memo_no = ?
       ORDER BY w.acted_at ASC, w.id ASC`,
      [memoNo]
    );

    return NextResponse.json(
      actionRows.map((row) => serializeWorkflowAction(memoNo, row))
    );
  } catch (error) {
    console.error("[GET /api/memos/[id]/workflow-actions]", error);
    return NextResponse.json({ error: "Unable to load workflow actions" }, { status: 500 });
  }
}
