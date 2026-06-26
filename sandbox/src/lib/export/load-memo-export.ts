// Loads a memo from the DB and serializes it together with its approval
// signatures, ready for the Excel export. Shared by the queue download route
// (`/api/memos/[id]/export-excel`) and the email-excel route so the two stay
// in lockstep.
import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import {
  serializeMemoRecord,
  type MemoDbRow,
  type MemoRevisionDbRow,
  type ReadActionDbRow,
  type WorkflowActionDbRow,
} from "@/lib/db-memos";
import type { ApprovalLevel, MemoRecord } from "@/lib/approval";
import type { MemoSignature } from "./memo-excel";

const SIGNATURE_LEVELS: ApprovalLevel[] = ["Manager / Top Section", "General Manager", "Managing Director"];

export function mapSignatureRows(rows: WorkflowActionDbRow[]): MemoSignature[] {
  return rows
    .filter((r) => r.step_label && SIGNATURE_LEVELS.includes(r.step_label as ApprovalLevel))
    .map((r) => ({
      stepLabel: r.step_label as ApprovalLevel,
      actorName: r.actor_name ?? "-",
      actedAt: typeof r.acted_at === "string" ? r.acted_at : r.acted_at.toISOString(),
    }));
}

export async function loadMemoForExport(
  memoNo: string,
  pool: Pool,
): Promise<{ memo: MemoRecord; signatures: MemoSignature[] } | null> {
  const [memoRows] = await pool.query<(RowDataPacket & MemoDbRow)[]>(
    "SELECT * FROM memos WHERE memo_no = ? LIMIT 1",
    [memoNo],
  );
  if (memoRows.length === 0) return null;
  const memoRow = memoRows[0];

  const [readRows] = await pool.query<(RowDataPacket & ReadActionDbRow)[]>(
    "SELECT recipient_name, status, acted_at, skip_reason FROM read_actions WHERE memo_id = ? AND revision_no = ? ORDER BY id ASC",
    [memoRow.id, memoRow.revision_no],
  );
  const [revisionRows] = await pool.query<(RowDataPacket & MemoRevisionDbRow)[]>(
    "SELECT revision_no, source, return_reason, reject_reason, revision_note, submitted_at, snapshot_json FROM memo_revisions WHERE memo_id = ? ORDER BY revision_no ASC, id ASC",
    [memoRow.id],
  );

  const memo = serializeMemoRecord(memoRow, readRows, revisionRows);

  const [actionRows] = await pool.query<(RowDataPacket & WorkflowActionDbRow)[]>(
    `SELECT revision_no, action_type, step_label, actor_name, result, reason, acted_at, metadata_json
       FROM workflow_step_actions
      WHERE memo_id = ? AND action_type IN ('approve', 'check')
      ORDER BY acted_at ASC, id ASC`,
    [memoRow.id],
  );

  return { memo, signatures: mapSignatureRows(actionRows) };
}
