import { NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildSubmitRevisionPayload, type SubmitRevisionBody } from "@/lib/db-memo-write";
import type { MemoSeedRow } from "@/lib/db-seed";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as SubmitRevisionBody;
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
    const { memoRevision, memoUpdate, newReadActions, workflowAction } = buildSubmitRevisionPayload(body);

    await connection.execute(
      `INSERT INTO memo_revisions (
         memo_id, revision_no, source, return_reason, reject_reason,
         revision_note, submitted_at, snapshot_json, revision_impact, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memoDbId,
        memoRevision.revision_no,
        memoRevision.source,
        memoRevision.return_reason,
        memoRevision.reject_reason,
        memoRevision.revision_note,
        memoRevision.submitted_at,
        memoRevision.snapshot_json,
        memoRevision.revision_impact,
        memoRevision.created_at,
      ]
    );

    // Update all mutable content and workflow fields. Identity fields are explicitly
    // excluded: memo_no (business key), requester_name (set at creation), created_at (immutable).
    await connection.execute(
      `UPDATE memos SET
         title = ?,
         department_name = ?,
         category = ?,
         amount = ?,
         budget_status = ?,
         account_code = ?,
         budget_plan = ?,
         budget_used = ?,
         description = ?,
         status = ?,
         workflow_state = ?,
         current_step = ?,
         cycle_hours = ?,
         recommended_final_approver = ?,
         recommended_route_json = ?,
         selected_route_json = ?,
         route_mode = ?,
         route_override_reason = ?,
         notify_md = ?,
         is_price_adjustment = ?,
         follows_production_plan = ?,
         is_dead_stock = ?,
         dept_monthly_over_budget_total = ?,
         return_reason = ?,
         reject_reason = ?,
         reject_disposition = ?,
         revision_no = ?,
         revision_submitted_at = ?,
         revision_note = ?,
         price_comparisons_json = ?,
         selected_vendor_id = ?,
         selected_vendor_reason = ?,
         price_adjustment_reason = ?,
         request_items_json = ?,
         read_recipients_json = ?,
         updated_at = ?
       WHERE id = ?`,
      memoUpdateParams(memoUpdate, memoDbId)
    );

    for (const ra of newReadActions) {
      await connection.execute(
        `INSERT INTO read_actions (
           memo_id, revision_no, recipient_name, status, acted_at,
           skip_reason, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memoDbId,
          ra.revision_no,
          ra.recipient_name,
          ra.status,
          ra.acted_at,
          ra.skip_reason,
          ra.created_at,
          ra.updated_at,
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
    console.error("[POST /api/memos/[id]/submit-revision]", error);
    return NextResponse.json({ error: "Unable to submit revision" }, { status: 500 });
  } finally {
    connection?.release();
  }
}

// All 36 mutable columns in the same field order as memoRowParams in api/memos/route.ts,
// minus the 3 immutable identity fields: memo_no, requester_name, created_at.
// Append memoDbId last for the WHERE id = ? clause.
function memoUpdateParams(row: MemoSeedRow, memoDbId: number) {
  return [
    row.title,
    row.department_name,
    row.category,
    row.amount,
    row.budget_status,
    row.account_code,
    row.budget_plan,
    row.budget_used,
    row.description,
    row.status,
    row.workflow_state,
    row.current_step,
    row.cycle_hours,
    row.recommended_final_approver,
    row.recommended_route_json,
    row.selected_route_json,
    row.route_mode,
    row.route_override_reason,
    row.notify_md,
    row.is_price_adjustment,
    row.follows_production_plan,
    row.is_dead_stock,
    row.dept_monthly_over_budget_total,
    row.return_reason,
    row.reject_reason,
    row.reject_disposition,
    row.revision_no,
    row.revision_submitted_at,
    row.revision_note,
    row.price_comparisons_json,
    row.selected_vendor_id,
    row.selected_vendor_reason,
    row.price_adjustment_reason,
    row.request_items_json,
    row.read_recipients_json,
    row.updated_at,
    memoDbId,
  ];
}
