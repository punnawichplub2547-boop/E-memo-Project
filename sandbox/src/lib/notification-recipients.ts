// Resolve notification recipients. Returns user_id[] for notifications ONLY.
// Department/name matching here does NOT grant workflow permission or memo visibility.
import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

type IdRow = RowDataPacket & { id: number };

export async function resolveApprovalStepRecipients(
  approvalLevel: string,
  pool: Pool,
): Promise<number[]> {
  const [rows] = await pool.query<IdRow[]>(
    "SELECT id FROM users WHERE approval_level = ? AND status = 'active'",
    [approvalLevel],
  );
  return rows.map(r => r.id);
}

export async function resolveRequesterRecipient(
  requesterName: string,
  pool: Pool,
): Promise<number | null> {
  const [rows] = await pool.query<IdRow[]>(
    "SELECT id FROM users WHERE CONCAT(first_name, ' ', last_name) = ? AND status = 'active' LIMIT 1",
    [requesterName],
  );
  return rows[0]?.id ?? null;
}

export async function resolveReadRecipientLabels(
  labels: string[],
  pool: Pool,
): Promise<number[]> {
  const idSet = new Set<number>();
  for (const label of labels) {
    const [byEmail] = await pool.query<IdRow[]>(
      "SELECT id FROM users WHERE email = ? AND status = 'active' LIMIT 1",
      [label],
    );
    if (byEmail.length > 0) { idSet.add(byEmail[0].id); continue; }

    const [byName] = await pool.query<IdRow[]>(
      "SELECT id FROM users WHERE CONCAT(first_name, ' ', last_name) = ? AND status = 'active' LIMIT 1",
      [label],
    );
    if (byName.length > 0) { idSet.add(byName[0].id); continue; }

    const [byDept] = await pool.query<IdRow[]>(
      "SELECT id FROM users WHERE department = ? AND status = 'active'",
      [label],
    );
    byDept.forEach(r => idSet.add(r.id));
  }
  return [...idSet];
}
