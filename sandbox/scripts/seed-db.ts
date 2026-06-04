import mysql from "mysql2/promise";
import { seedMemos } from "../src/lib/approval";
import { assertSeedAllowed, buildSeedWorkflowAction, memoToDbSeedRow, type MemoSeedRow } from "../src/lib/db-seed";

const DEFAULT_DATABASE_URL = "mysql://hr_ememo:hr_ememo_dev_password@127.0.0.1:3307/hr_ememo";
type SqlValue = string | number | boolean | null;

async function main() {
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  assertSeedAllowed(databaseUrl, process.env.CONFIRM_DB_SEED);
  const connection = await mysql.createConnection(databaseUrl);

  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM workflow_step_actions");
    await connection.execute("DELETE FROM read_actions");
    await connection.execute("DELETE FROM memo_revisions");
    await connection.execute("DELETE FROM memos");

    for (const memo of seedMemos) {
      const memoRow = memoToDbSeedRow(memo);
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        `INSERT INTO memos (
          memo_no, title, requester_name, department_name, category,
          amount, budget_status, account_code, budget_plan, budget_used, description,
          status, workflow_state, current_step, cycle_hours,
          recommended_final_approver, recommended_route_json, selected_route_json,
          route_mode, route_override_reason, notify_md,
          is_price_adjustment, follows_production_plan, is_dead_stock, dept_monthly_over_budget_total,
          return_reason, reject_reason, reject_disposition,
          revision_no, revision_submitted_at, revision_note,
          price_comparisons_json, selected_vendor_id, selected_vendor_reason, price_adjustment_reason,
          request_items_json, read_recipients_json,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?
        )`,
        memoSeedParams(memoRow)
      );

      const action = buildSeedWorkflowAction(memoRow);
      await connection.execute(
        `INSERT INTO workflow_step_actions (
          memo_id, revision_no, action_type, step_label, actor_name,
          result, reason, acted_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          action.revision_no,
          action.action_type,
          action.step_label,
          action.actor_name,
          action.result,
          action.reason,
          action.acted_at,
          action.metadata_json,
        ]
      );
    }

    await connection.commit();
    console.log(`Seeded ${seedMemos.length} memos and ${seedMemos.length} submit workflow actions.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

function memoSeedParams(row: MemoSeedRow): SqlValue[] {
  return [
    row.memo_no,
    row.title,
    row.requester_name,
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
    row.created_at,
    row.updated_at,
  ];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
