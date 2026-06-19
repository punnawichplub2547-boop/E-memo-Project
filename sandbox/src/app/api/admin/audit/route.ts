import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { serializeWorkflowAction, type WorkflowActionDbRow } from "@/lib/db-memos";
import { buildAuditQuery } from "@/lib/audit-query";

export const dynamic = "force-dynamic";

// Row shape from the JOIN: workflow_step_actions columns + memo_no from memos.
// memo_no is added so serializeWorkflowAction can stamp it onto each action
// (the table itself only stores memo_id).
type AuditRow = RowDataPacket & WorkflowActionDbRow & { memo_no: string };
type CountRow = RowDataPacket & { total: number };

function intParam(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  // Gate: admin only (same pattern as /api/admin/users).
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const { whereSql, params, limit, offset } = buildAuditQuery({
      memo: sp.get("memo") ?? undefined,
      action: sp.get("action") ?? undefined,
      actor: sp.get("actor") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      limit: intParam(sp.get("limit")),
      offset: intParam(sp.get("offset")),
    });

    const pool = getDbPool();

    // Audit intentionally does NOT filter deleted_at: a voided memo's actions
    // must remain visible. (Destroyed memos already had their action rows
    // hard-deleted, so they simply do not appear.)
    const [rows] = await pool.query<AuditRow[]>(
      `SELECT m.memo_no,
              w.revision_no, w.action_type, w.step_label, w.actor_name,
              w.result, w.reason, w.acted_at, w.metadata_json
       FROM workflow_step_actions w
       JOIN memos m ON m.id = w.memo_id
       ${whereSql}
       ORDER BY w.acted_at DESC, w.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM workflow_step_actions w
       JOIN memos m ON m.id = w.memo_id
       ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    return NextResponse.json({
      rows: rows.map((row) => serializeWorkflowAction(row.memo_no, row)),
      total,
    });
  } catch (error) {
    console.error("[GET /api/admin/audit]", error);
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }
}
