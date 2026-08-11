// Server-side trust boundary for custom per-person routes.
//
// The client may only say WHO it wants, in what order. It never gets to author
// the step tokens or the name snapshot: a hand-crafted selected_route_json could
// otherwise name a user id the picker would never offer, or attach a fake
// approval level that later shows up on the printed ISO form. So we take the
// ordered user ids, verify every one of them is an active user, and rebuild both
// the route and the snapshot from the users table.
import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { buildCustomRoute, type CustomApprover } from "./custom-route";

type ApproverRow = RowDataPacket & {
  id: number;
  first_name: string;
  last_name: string;
  approval_level: string | null;
  department: string;
};

/**
 * - `none`    — the request never asked for a custom route; the caller keeps its
 *               existing Book1 level-route behaviour untouched.
 * - `ok`      — a verified route rebuilt from the users table.
 * - `invalid` — the request DID ask for a custom route that cannot be honoured.
 *               The caller must answer 400 with `message`, never fall back: a silent
 *               fallback would send the document down a completely different chain of
 *               approvers than the requester picked, with nothing on screen saying so.
 */
export type CustomRouteResolution =
  | { status: "none" }
  | { status: "ok"; route: string[]; approvers: CustomApprover[] }
  | { status: "invalid"; message: string };

const RETRY_HINT = "กรุณาเลือกผู้อนุมัติใหม่";

function readOrderedUserIds(requested: unknown): number[] | null {
  const ids: number[] = [];
  for (const entry of requested as unknown[]) {
    if (typeof entry !== "object" || entry === null) return null;
    const userId = (entry as { userId?: unknown }).userId;
    if (typeof userId !== "number" || !Number.isInteger(userId) || userId < 1) return null;
    ids.push(userId);
  }
  return ids;
}

/** Names the unavailable people for the error message. Runs only on the failure
 *  path, and deliberately without the status filter — an inactive user still has a
 *  name, and "สมชาย ใจดี ไม่อยู่ในระบบแล้ว" is actionable where a bare id is not. */
async function describeUnavailable(pool: Pool, missingIds: number[]): Promise<string> {
  let names = new Map<number, string>();
  try {
    const [rows] = await pool.query<ApproverRow[]>(
      "SELECT id, first_name, last_name, approval_level, department FROM users WHERE id IN (?)",
      [missingIds],
    );
    names = new Map(rows.map((r) => [r.id, `${r.first_name} ${r.last_name}`.trim()]));
  } catch {
    // Naming is a nicety; the refusal itself must still happen.
  }
  return missingIds.map((id) => names.get(id) || `รหัสผู้ใช้ ${id}`).join(", ");
}

export async function resolveCustomRouteFromRequest(
  pool: Pool,
  requested: unknown,
): Promise<CustomRouteResolution> {
  // Absent / empty / not-a-list: the client is on the Book1 tab. Not an error.
  if (!Array.isArray(requested) || requested.length === 0) return { status: "none" };

  const ids = readOrderedUserIds(requested);
  if (!ids) {
    return { status: "invalid", message: `รูปแบบรายชื่อผู้อนุมัติไม่ถูกต้อง — ${RETRY_HINT}` };
  }

  const unique = [...new Set(ids)];
  const [rows] = await pool.query<ApproverRow[]>(
    "SELECT id, first_name, last_name, approval_level, department FROM users WHERE id IN (?) AND status = 'active'",
    [unique],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));

  // All-or-nothing: a route with a hole would deadlock at that step.
  const missing = unique.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const who = await describeUnavailable(pool, missing);
    console.warn(`[resolveCustomRouteFromRequest] custom route names inactive/unknown user(s): ${missing.join(", ")}`);
    return {
      status: "invalid",
      message: `ไม่สามารถส่งได้: ${who} ไม่อยู่ในระบบแล้ว ${RETRY_HINT}`,
    };
  }

  const built = buildCustomRoute(
    ids.map((id) => {
      const row = byId.get(id)!;
      return {
        userId: row.id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        approvalLevel: row.approval_level,
        department: row.department,
      };
    }),
  );
  return { status: "ok", ...built };
}
