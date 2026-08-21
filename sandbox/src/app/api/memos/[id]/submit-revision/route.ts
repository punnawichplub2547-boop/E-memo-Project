import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildSubmitRevisionPayload, type SubmitRevisionBody } from "@/lib/db-memo-write";
import type { MemoSeedRow } from "@/lib/db-seed";
import type { ApprovalStepKey } from "@/lib/approval";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { notifyMemoEvent } from "@/lib/notify-memo-event";
import { isMemoOwner } from "@/lib/memo-ownership";
import { departmentHasActiveSupervisor } from "@/lib/db-users";
import { applySupervisorRouting } from "@/lib/supervisor-routing";
import { resolveCustomRouteFromRequest } from "@/lib/custom-route-server";
import { findForgedCustomStep } from "@/lib/custom-route";
import { resolveBodyBlocksFromRequest } from "@/lib/memo-body-blocks-server";
import type { MemoFormMode } from "@/lib/memo-body-blocks";

export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & {
  id: number;
  requester_name: string;
  requester_user_id: number | null;
  status: string;
  reject_disposition: string | null;
  revision_no: number;
  return_to_step: string | null;
  form_mode: MemoFormMode | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connection: PoolConnection | null = null;
  try {
    const body = (await request.json()) as SubmitRevisionBody;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<MemoIdRow[]>(
      "SELECT id, requester_name, requester_user_id, status, reject_disposition, revision_no, return_to_step, form_mode FROM memos WHERE memo_no = ? AND deleted_at IS NULL FOR UPDATE",
      [memoNo]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memo = rows[0];

    // Ownership: FK is authoritative when set (a FK pointing to another user is
    // NOT theirs — no name fallback); FK null falls back to the legacy name match.
    const isAdmin = session.roles.includes("admin");
    const owns = isMemoOwner({
      requesterUserId: memo.requester_user_id,
      requesterName: memo.requester_name,
      sessionUserId: session.userId,
      sessionFullName: `${session.firstName} ${session.lastName}`,
    });
    if (!isAdmin && !owns) {
      await connection.rollback();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // State machine guard: only returned or rejected+revision-allowed can be revised
    // (mirrors the resubmit route — prevents resurrecting a pending/approved memo).
    const canResubmit =
      memo.status === "returned" ||
      (memo.status === "rejected" && memo.reject_disposition === "revision-allowed");
    if (!canResubmit) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo cannot be resubmitted in its current state" }, { status: 409 });
    }

    body.actorName = `${session.firstName} ${session.lastName}`;
    // Server derives the revision number from the DB, never the client.
    body.oldRevisionNo = memo.revision_no;

    const memoDbId = memo.id;
    const { memoRevision, memoUpdate, newReadActions, workflowAction } = buildSubmitRevisionPayload(body);

    // Custom per-person route: same trust boundary as POST /api/memos — the client
    // only names user ids and the server rebuilds the tokens and the name snapshot.
    // A revision may switch a memo between the two modes in either direction, so the
    // else-branch must clear custom_route_json rather than leave a stale snapshot.
    const custom = await resolveCustomRouteFromRequest(pool, body.customRoute);
    // Same refusal contract as POST /api/memos - never silently reroute.
    // Roll back first: the SELECT ... FOR UPDATE above opened a transaction and holds a
    // row lock, and releasing the connection without ending the transaction leaks both.
    if (custom.status === "invalid") {
      await connection.rollback();
      return NextResponse.json({ error: custom.message }, { status: 400 });
    }
    let effectiveRoute: ApprovalStepKey[];
    if (custom.status === "ok") {
      effectiveRoute = custom.route;
      memoUpdate.selected_route_json = JSON.stringify(custom.route);
      memoUpdate.recommended_route_json = JSON.stringify(custom.route);
      memoUpdate.custom_route_json = JSON.stringify(custom.approvers);
      // Same audit contract as POST /api/memos: a per-person route never matches the
      // Book1 ladder, so it is recorded as an exception with a reason. Without this the
      // client's routeMode won — and in free-form mode the client always sends
      // "recommended" (RoutingCard is never rendered, so routeReview.mode never moves),
      // which made the drawer's "Exception: <reason>" line disappear on every revision.
      memoUpdate.route_mode = "exception";
      memoUpdate.route_override_reason =
        memoUpdate.route_override_reason?.trim() || "กำหนดผู้อนุมัติเองเป็นรายบุคคล (custom route)";
    } else {
      // No server-built route, so any person token here is client-authored. Same reasoning
      // as POST /api/memos: the token IS the approver's identity to canActOnStep, so a
      // forged one silently reassigns approval authority on an existing document.
      const forged = findForgedCustomStep(
        JSON.parse(memoUpdate.selected_route_json || "[]") as unknown[],
        JSON.parse(memoUpdate.recommended_route_json || "[]") as unknown[],
      );
      if (forged) {
        await connection.rollback();
        console.warn(
          `[POST /api/memos/[id]/submit-revision] rejected forged custom route step "${forged}" from user ${session.userId}`,
        );
        return NextResponse.json({ error: "รูปแบบเส้นทางอนุมัติไม่ถูกต้อง — กรุณาเลือกผู้อนุมัติใหม่" }, { status: 400 });
      }
      memoUpdate.custom_route_json = null;
      // Server-authoritative Supervisor step: strip any client "Supervisor" and, only
      // when the (possibly re-picked) department has an active Supervisor, prepend it.
      const hasSupervisor = await departmentHasActiveSupervisor(pool, memoUpdate.department_name);
      const supervised = applySupervisorRouting(
        JSON.parse(memoUpdate.selected_route_json || "[]") as ApprovalStepKey[],
        JSON.parse(memoUpdate.recommended_route_json || "[]") as ApprovalStepKey[],
        hasSupervisor,
      );
      effectiveRoute = supervised.selectedRoute;
      memoUpdate.selected_route_json = supervised.selectedRoute.length ? JSON.stringify(supervised.selectedRoute) : null;
      memoUpdate.recommended_route_json = supervised.recommendedRoute.length ? JSON.stringify(supervised.recommendedRoute) : null;
    }

    // V3 free-form body: same trust boundary as POST /api/memos. hasCustomRoute mirrors
    // the resolved route, not the raw request — a genuine per-person route only exists
    // when the resolver actually rebuilt one from the users table. The clear* flags
    // become real UPDATE writes below (memoUpdate.price_comparisons_json / .request_items_json),
    // overriding whatever the client's nextMemoRow snapshot happened to carry — otherwise a
    // removed system block would leave orphaned data no UI shows again.
    //
    // The form mode itself is locked to the memo's stored form_mode (Q5) — a revision
    // can never switch a memo between standard and free-form, enforced by
    // existingFormMode below. There is no fallback to the stored blocks for a
    // free-form memo: body.bodyBlocks ?? null means an existing free-form memo that
    // omits bodyBlocks on this revision gets a hard 400 from the resolver ("bodyBlocks
    // ต้องเป็น array"), not a silent carry-forward of whatever it had before. The
    // client must resend its full block set on every free-form revision.
    const hasCustomRoute = custom.status === "ok" && custom.approvers.length > 0;
    const bodyBlocks = resolveBodyBlocksFromRequest({
      formMode: body.formMode ?? memo.form_mode ?? "standard",
      blocks: body.bodyBlocks ?? null,
      hasCustomRoute,
      existingFormMode: (memo.form_mode ?? "standard") as MemoFormMode,
    });
    if (bodyBlocks.status === "invalid") {
      await connection.rollback();
      return NextResponse.json({ error: bodyBlocks.reason }, { status: 400 });
    }
    memoUpdate.form_mode = bodyBlocks.formMode;
    memoUpdate.body_blocks_json = bodyBlocks.blocks === null ? null : JSON.stringify(bodyBlocks.blocks);
    if (bodyBlocks.clearPriceComparisons) memoUpdate.price_comparisons_json = null;
    if (bodyBlocks.clearRequestItems) memoUpdate.request_items_json = null;

    // Server-derive current_step. Honor the approver's chosen return destination
    // (return_to_step) when it is still a member of the route; otherwise restart from
    // the first step. Never trust the client to redirect approval notifications.
    const returnToStep = memo.return_to_step;
    memoUpdate.current_step =
      returnToStep && effectiveRoute.includes(returnToStep)
        ? returnToStep
        : effectiveRoute[0] ?? "Manager / Top Section";

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
    // excluded: memo_no (business key), requester_name + requester_user_id (set at
    // creation), created_at (immutable).
    await connection.execute(
      `UPDATE memos SET
         title = ?,
         department_name = ?,
         category = ?,
         item_subcategory_id = ?,
         item_subcategory_label = ?,
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
         custom_route_json = ?,
         route_mode = ?,
         route_override_reason = ?,
         notify_md = ?,
         requires_md_review = ?,
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
         form_mode = ?,
         body_blocks_json = ?,
         md_review_status = ?,
         md_review_resume_step = ?,
         md_review_comment = ?,
         md_review_acted_by = ?,
         md_review_acted_at = ?,
         return_to_step = NULL,
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
    void notifyMemoEvent(memoNo, "resubmitted", session.userId).catch((err) =>
      console.error("[notifyMemoEvent] resubmitted failed:", err));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[POST /api/memos/[id]/submit-revision]", error);
    return NextResponse.json({ error: "Unable to submit revision" }, { status: 500 });
  } finally {
    connection?.release();
  }
}

// All 47 parameterised mutable columns, in the same field order as memoRowParams in
// api/memos/route.ts, minus the immutable identity fields: memo_no, requester_name,
// requester_user_id, created_at. Append memoDbId last for the WHERE id = ? clause,
// giving 48 placeholders in total.
//
// The UPDATE above assigns 48 columns: these 47 plus `return_to_step = NULL`, which is
// a literal and takes no parameter. Counted twice by hand and once by script — the
// comment used to say 44, and a wrong number in exactly this spot has broken prod in
// this project before, because it is what the next editor checks alignment against.
function memoUpdateParams(row: MemoSeedRow, memoDbId: number) {
  return [
    row.title,
    row.department_name,
    row.category,
    row.item_subcategory_id,
    row.item_subcategory_label,
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
    row.custom_route_json,
    row.route_mode,
    row.route_override_reason,
    row.notify_md,
    row.requires_md_review,
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
    row.form_mode,
    row.body_blocks_json,
    row.md_review_status,
    row.md_review_resume_step,
    row.md_review_comment,
    row.md_review_acted_by,
    row.md_review_acted_at,
    row.updated_at,
    memoDbId,
  ];
}
