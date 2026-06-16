import type { PoolConnection } from "mysql2/promise";

type CascadeConnection = Pick<PoolConnection, "execute">;

export async function deleteMemoCascadeRows(connection: CascadeConnection, memoDbId: number) {
  await connection.execute(
    "DELETE nd FROM notification_deliveries nd INNER JOIN notifications n ON n.id = nd.notification_id WHERE n.memo_id = ?",
    [memoDbId]
  );
  await connection.execute("DELETE FROM telegram_action_tokens WHERE memo_id = ?", [memoDbId]);
  await connection.execute("DELETE FROM notifications WHERE memo_id = ?", [memoDbId]);
  await connection.execute("DELETE FROM read_actions WHERE memo_id = ?", [memoDbId]);
  await connection.execute("DELETE FROM workflow_step_actions WHERE memo_id = ?", [memoDbId]);
  await connection.execute("DELETE FROM memo_revisions WHERE memo_id = ?", [memoDbId]);
  await connection.execute("DELETE FROM memos WHERE id = ?", [memoDbId]);
}
