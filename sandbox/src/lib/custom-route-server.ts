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

function readOrderedUserIds(requested: unknown): number[] | null {
  if (!Array.isArray(requested) || requested.length === 0) return null;
  const ids: number[] = [];
  for (const entry of requested) {
    if (typeof entry !== "object" || entry === null) return null;
    const userId = (entry as { userId?: unknown }).userId;
    if (typeof userId !== "number" || !Number.isInteger(userId) || userId < 1) return null;
    ids.push(userId);
  }
  return ids;
}

/** Returns null when the request carries no usable custom route — the caller then
 *  falls back to the classic Book1 level route. Never throws on bad input. */
export async function resolveCustomRouteFromRequest(
  pool: Pool,
  requested: unknown,
): Promise<{ route: string[]; approvers: CustomApprover[] } | null> {
  const ids = readOrderedUserIds(requested);
  if (!ids) return null;

  const unique = [...new Set(ids)];
  const [rows] = await pool.query<ApproverRow[]>(
    "SELECT id, first_name, last_name, approval_level, department FROM users WHERE id IN (?) AND status = 'active'",
    [unique],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));

  // All-or-nothing: a route with a hole would deadlock at that step, and silently
  // dropping a person the requester deliberately picked is worse than refusing.
  if (unique.some((id) => !byId.has(id))) {
    console.warn(
      "[resolveCustomRouteFromRequest] custom route references a user who is not active — rejected",
    );
    return null;
  }

  return buildCustomRoute(
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
}
