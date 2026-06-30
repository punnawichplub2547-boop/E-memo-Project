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
  if (rows.length === 0) {
    // No active user carries this exact approval_level, so the actionable approver
    // notification (with the approve button) reaches NOBODY. Surface it instead of
    // silently dropping — the usual cause is the step's approver (e.g. the MD) not
    // having approval_level set to this exact label. Fix via Admin > assign role.
    console.warn(
      `[resolveApprovalStepRecipients] no active user has approval_level="${approvalLevel}" — approver notification not delivered for this step`,
    );
  }
  return rows.map(r => r.id);
}

// Resolve the requester's notification target.
//   - requesterUserId set (FK) → authoritative: look the user up by id. If that
//     user is suspended/inactive, return null — NEVER fall back to a name match
//     (the FK is the source of truth; falling back would reintroduce the
//     name-collision bug this FK was added to fix).
//   - requesterUserId null/undefined (legacy/seed/prototype) → fall back to the
//     active full-name match (the original behaviour).
export async function resolveRequesterRecipient(
  requesterName: string,
  requesterUserId: number | null | undefined,
  pool: Pool,
): Promise<number | null> {
  if (requesterUserId != null) {
    const [rows] = await pool.query<IdRow[]>(
      "SELECT id FROM users WHERE id = ? AND status = 'active' LIMIT 1",
      [requesterUserId],
    );
    return rows[0]?.id ?? null;
  }

  const [rows] = await pool.query<IdRow[]>(
    "SELECT id FROM users WHERE CONCAT(first_name, ' ', last_name) = ? AND status = 'active' LIMIT 1",
    [requesterName],
  );
  return rows[0]?.id ?? null;
}

type CcUserRow = RowDataPacket & { id: number; email: string; full_name: string };

// CC notifications target INDIVIDUALS only. Labels are matched by email or exact
// full name; department labels (or anything unmatched) are skipped — never fanned
// out to a whole department. Filtered by the memo's current revision so CC removed
// in a later revision is not notified.
export async function resolveMemoCcRecipients(
  memoId: number,
  revisionNo: number,
  pool: Pool,
): Promise<number[]> {
  const [labelRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT recipient_name FROM read_actions WHERE memo_id = ? AND revision_no = ?",
    [memoId, revisionNo],
  );
  const labels = labelRows
    .map((r) => String((r as { recipient_name: string }).recipient_name))
    .filter((s) => s.length > 0);
  if (labels.length === 0) return [];

  const [userRows] = await pool.query<CcUserRow[]>(
    `SELECT id, email, CONCAT(first_name, ' ', last_name) AS full_name
       FROM users
      WHERE status = 'active'
        AND (email IN (?) OR CONCAT(first_name, ' ', last_name) IN (?))`,
    [labels, labels],
  );

  const matched = new Set<string>();
  const ids = new Set<number>();
  for (const row of userRows) {
    ids.add(row.id);
    matched.add(row.email);
    matched.add(row.full_name);
  }
  for (const label of labels) {
    if (!matched.has(label)) {
      console.warn(`[resolveMemoCcRecipients] CC label not matched to an individual user (skipped): ${label}`);
    }
  }
  return [...ids];
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
