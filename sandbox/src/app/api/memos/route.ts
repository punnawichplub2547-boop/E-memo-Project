import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import type { MemoRecord } from "@/lib/approval";
import {
  buildMemoWritePayload,
  buildNewMemoReadActionRows,
  buildNewMemoWorkflowAction,
} from "@/lib/db-memo-write";
import type { MemoSeedRow } from "@/lib/db-seed";
import { serializeMemoRecord, type MemoDbRow, type MemoRevisionDbRow, type ReadActionDbRow } from "@/lib/db-memos";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { isMemoVisibleTo } from "@/lib/memo-visibility";
import { notifyMemoEvent } from "@/lib/notify-memo-event";

export const dynamic = "force-dynamic";

type ReadActionRowWithMemo = ReadActionDbRow & {
  memo_id: number;
};

type MemoRevisionRowWithMemo = MemoRevisionDbRow & {
  memo_id: number;
};

export async function GET(req: NextRequest) {
  try {
    // Auth enforcement — do not rely solely on middleware.
    // getActiveSessionUserFromToken verifies the JWT signature AND checks DB status === "active".
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = getDbPool();
    const [memoRows] = await pool.query<QueryRows<MemoDbRow>>(
      "SELECT * FROM memos ORDER BY created_at DESC, id DESC"
    );
    const [readRows] = await pool.query<QueryRows<ReadActionRowWithMemo>>(
      `SELECT ra.memo_id, ra.recipient_name, ra.status, ra.acted_at, ra.skip_reason
       FROM read_actions ra
       JOIN memos m ON ra.memo_id = m.id AND ra.revision_no = m.revision_no
       ORDER BY ra.id ASC`
    );
    const [revisionRows] = await pool.query<QueryRows<MemoRevisionRowWithMemo>>(
      `SELECT memo_id, revision_no, source, return_reason, reject_reason,
              revision_note, submitted_at, snapshot_json
       FROM memo_revisions
       ORDER BY memo_id ASC, revision_no ASC, id ASC`
    );

    const readsByMemoId = new Map<number, ReadActionDbRow[]>();
    for (const row of readRows) {
      const rows = readsByMemoId.get(row.memo_id) ?? [];
      rows.push(row);
      readsByMemoId.set(row.memo_id, rows);
    }

    const revisionsByMemoId = new Map<number, MemoRevisionDbRow[]>();
    for (const row of revisionRows) {
      const rows = revisionsByMemoId.get(row.memo_id) ?? [];
      rows.push(row);
      revisionsByMemoId.set(row.memo_id, rows);
    }

    const allMemos = memoRows.map((row) => serializeMemoRecord(
      row,
      readsByMemoId.get(row.id) ?? [],
      revisionsByMemoId.get(row.id) ?? [],
    ));

    // Admin bypasses filtering — sees every memo including soft-deleted.
    // All other roles see only memos permitted by isMemoVisibleTo.
    const visible = session.roles.includes("admin")
      ? allMemos
      : allMemos.filter(m => isMemoVisibleTo(m, session));

    return NextResponse.json(visible);
  } catch (error) {
    console.error("[GET /api/memos]", error);
    return NextResponse.json({ error: "Unable to load memos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connection: PoolConnection | null = null;
  try {
    const memo = await request.json() as MemoRecord;
    // Never trust the client for identity — the creator is the session user.
    memo.requester = `${session.firstName} ${session.lastName}`;
    memo.requesterUserId = session.userId;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const memoId = await insertMemo(connection, memo);
    await connection.commit();

    // Fire-and-forget AFTER commit so the read_actions rows are visible to the dispatcher pool.
    void notifyMemoEvent(memo.id, "submitted", session.userId).catch(() => {});

    return NextResponse.json({ id: memo.id, memoDbId: memoId }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    if (isDuplicateMemoNoError(error)) {
      return NextResponse.json({ error: "Memo already exists" }, { status: 409 });
    }
    console.error("[POST /api/memos]", error);
    return NextResponse.json({ error: "Unable to create memo" }, { status: 500 });
  } finally {
    connection?.release();
  }
}

async function insertMemo(connection: PoolConnection, memo: MemoRecord): Promise<number> {
  const { row } = buildMemoWritePayload(memo);
  const [result] = await connection.execute<import("mysql2").ResultSetHeader>(
    `INSERT INTO memos (
      memo_no, title, requester_name, requester_user_id, department_name, category,
      amount, budget_status, account_code, budget_plan, budget_used, description, closing_remark,
      status, workflow_state, current_step, cycle_hours,
      recommended_final_approver, recommended_route_json, selected_route_json,
      route_mode, route_override_reason, notify_md,
      is_price_adjustment, follows_production_plan, is_dead_stock, dept_monthly_over_budget_total,
      return_reason, reject_reason, reject_disposition,
      revision_no, revision_submitted_at, revision_note,
      price_comparisons_json, selected_vendor_id, selected_vendor_reason, price_adjustment_reason,
      request_items_json, read_recipients_json, attachments_json,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )`,
    memoRowParams(row)
  );

  const workflowAction = buildNewMemoWorkflowAction(row);
  await connection.execute(
    `INSERT INTO workflow_step_actions (
      memo_id, revision_no, action_type, step_label, actor_name,
      result, reason, acted_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.insertId,
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

  for (const readAction of buildNewMemoReadActionRows(memo)) {
    await connection.execute(
      `INSERT INTO read_actions (
        memo_id, revision_no, recipient_name, status, acted_at,
        skip_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.insertId,
        readAction.revision_no,
        readAction.recipient_name,
        readAction.status,
        readAction.acted_at,
        readAction.skip_reason,
        readAction.created_at,
        readAction.updated_at,
      ]
    );
  }

  return result.insertId;
}

function memoRowParams(row: MemoSeedRow) {
  return [
    row.memo_no,
    row.title,
    row.requester_name,
    row.requester_user_id,
    row.department_name,
    row.category,
    row.amount,
    row.budget_status,
    row.account_code,
    row.budget_plan,
    row.budget_used,
    row.description,
    row.closing_remark,
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
    row.attachments_json,
    row.created_at,
    row.updated_at,
  ];
}

function isDuplicateMemoNoError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_DUP_ENTRY";
}

type QueryRows<T> = T[] & RowDataPacket[];
