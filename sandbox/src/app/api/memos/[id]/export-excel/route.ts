import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { isMemoVisibleTo } from "@/lib/memo-visibility";
import {
  serializeMemoRecord,
  type MemoDbRow,
  type MemoRevisionDbRow,
  type ReadActionDbRow,
  type WorkflowActionDbRow,
} from "@/lib/db-memos";
import { memoToExcelBuffer, type MemoSignature } from "@/lib/export/memo-excel";
import type { ApprovalLevel } from "@/lib/approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoRow = RowDataPacket & MemoDbRow;
type ReadRow = RowDataPacket & ReadActionDbRow;
type RevisionRow = RowDataPacket & MemoRevisionDbRow;
type ActionRow = RowDataPacket & WorkflowActionDbRow;

const SIGNATURE_LEVELS: ApprovalLevel[] = ["Manager / Top Section", "General Manager", "Managing Director"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pool = getDbPool();
    const [memoRows] = await pool.query<MemoRow[]>(
      "SELECT * FROM memos WHERE memo_no = ? LIMIT 1",
      [memoNo]
    );
    if (memoRows.length === 0) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    const memoRow = memoRows[0];

    const [readRows] = await pool.query<ReadRow[]>(
      "SELECT recipient_name, status, acted_at, skip_reason FROM read_actions WHERE memo_id = ? AND revision_no = ? ORDER BY id ASC",
      [memoRow.id, memoRow.revision_no]
    );
    const [revisionRows] = await pool.query<RevisionRow[]>(
      "SELECT revision_no, source, return_reason, reject_reason, revision_note, submitted_at, snapshot_json FROM memo_revisions WHERE memo_id = ? ORDER BY revision_no ASC, id ASC",
      [memoRow.id]
    );

    const memo = serializeMemoRecord(memoRow, readRows, revisionRows);

    if (!session.roles.includes("admin") && !isMemoVisibleTo(memo, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [actionRows] = await pool.query<ActionRow[]>(
      `SELECT revision_no, action_type, step_label, actor_name, result, reason, acted_at, metadata_json
       FROM workflow_step_actions
       WHERE memo_id = ? AND action_type IN ('approve', 'check')
       ORDER BY acted_at ASC, id ASC`,
      [memoRow.id]
    );
    const signatures: MemoSignature[] = actionRows
      .filter((row) => row.step_label && SIGNATURE_LEVELS.includes(row.step_label as ApprovalLevel))
      .map((row) => ({
        stepLabel: row.step_label as ApprovalLevel,
        actorName: row.actor_name ?? "-",
        actedAt: typeof row.acted_at === "string" ? row.acted_at : row.acted_at.toISOString(),
      }));

    const buffer = await memoToExcelBuffer(memo, signatures);
    const safeName = memoNo.replace(/[^A-Za-z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="memo-${safeName}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/memos/[id]/export-excel]", error);
    return NextResponse.json({ error: "Unable to export memo" }, { status: 500 });
  }
}
