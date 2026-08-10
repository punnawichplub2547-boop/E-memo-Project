import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { resolveCustomRouteFromRequest } from "./custom-route-server";
import { isCustomRoute } from "./custom-route";
import { applySupervisorRouting } from "./supervisor-routing";
import { canActOnStep, evaluateApproveAction, evaluateRejectAction } from "./workflow-rules";

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  approval_level: string | null;
  department: string;
};

function fakePool(users: UserRow[]): Pool {
  return {
    query: async (_sql: string, params: unknown[]) => {
      const wanted = params[0] as number[];
      const rows = users.filter((u) => wanted.includes(u.id));
      return [rows, undefined];
    },
  } as unknown as Pool;
}

const users: UserRow[] = [
  { id: 42, first_name: "สมชาย", last_name: "ใจดี", approval_level: "Manager / Top Section", department: "IT" },
  { id: 7, first_name: "สุภาพร", last_name: "เจริญสุข", approval_level: "General Manager", department: "PD" },
];

describe("resolveCustomRouteFromRequest", () => {
  it("builds tokens and a name snapshot from the DB, preserving the requested order", async () => {
    const result = await resolveCustomRouteFromRequest(fakePool(users), [{ userId: 7 }, { userId: 42 }]);
    expect(result).not.toBeNull();
    expect(result!.route).toEqual(["person:1#7", "person:2#42"]);
    expect(result!.approvers[0]).toEqual({
      stepKey: "person:1#7",
      userId: 7,
      name: "สุภาพร เจริญสุข",
      approvalLevel: "General Manager",
      department: "PD",
    });
  });

  it("ignores client-supplied names and levels entirely", async () => {
    const result = await resolveCustomRouteFromRequest(fakePool(users), [
      { userId: 42, name: "ปลอม ปลอม", approvalLevel: "Managing Director", stepKey: "person:9#1" },
    ]);
    expect(result!.approvers[0].name).toBe("สมชาย ใจดี");
    expect(result!.approvers[0].approvalLevel).toBe("Manager / Top Section");
    expect(result!.route).toEqual(["person:1#42"]);
  });

  it("returns null when any requested user is missing or inactive", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await resolveCustomRouteFromRequest(fakePool(users), [{ userId: 42 }, { userId: 404 }])).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for an empty, absent, or malformed request", async () => {
    expect(await resolveCustomRouteFromRequest(fakePool(users), undefined)).toBeNull();
    expect(await resolveCustomRouteFromRequest(fakePool(users), [])).toBeNull();
    expect(await resolveCustomRouteFromRequest(fakePool(users), "nope")).toBeNull();
    expect(await resolveCustomRouteFromRequest(fakePool(users), [{ userId: "42" }])).toBeNull();
    expect(await resolveCustomRouteFromRequest(fakePool(users), [{ userId: 0 }])).toBeNull();
    expect(await resolveCustomRouteFromRequest(fakePool(users), [null])).toBeNull();
  });

  it("keeps a person picked twice as two distinct steps", async () => {
    const result = await resolveCustomRouteFromRequest(fakePool(users), [
      { userId: 42 },
      { userId: 7 },
      { userId: 42 },
    ]);
    expect(result!.route).toEqual(["person:1#42", "person:2#7", "person:3#42"]);
  });

  it("only ever queries active users", async () => {
    const calls: string[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        calls.push(sql);
        const wanted = params[0] as number[];
        return [users.filter((u) => wanted.includes(u.id)), undefined];
      },
    } as unknown as Pool;
    await resolveCustomRouteFromRequest(pool, [{ userId: 42 }]);
    expect(calls[0]).toContain("status = 'active'");
  });
});

// The custom-route feature hangs off one all-or-nothing predicate: isCustomRoute.
// A single non-token entry anywhere in the route silently demotes the memo back to
// the level-based rules — no test would fail, the Q22/Q23 rules would just stop
// applying. This walks the real server pipeline (resolve → Supervisor prepend →
// workflow rules) to prove nothing sneaks an extra step in.
describe("server route pipeline keeps a custom route custom", () => {
  const request = [{ userId: 42 }, { userId: 7 }];

  async function pipeline(hasSupervisor: boolean) {
    const custom = await resolveCustomRouteFromRequest(fakePool(users), request);
    expect(custom).not.toBeNull();
    const supervised = applySupervisorRouting(custom!.route, custom!.route, hasSupervisor);
    return supervised;
  }

  it("stays a custom route even when the department HAS an active Supervisor", async () => {
    const supervised = await pipeline(true);
    expect(supervised.selectedRoute).toEqual(["person:1#42", "person:2#7"]);
    expect(isCustomRoute(supervised.selectedRoute)).toBe(true);
    expect(isCustomRoute(supervised.recommendedRoute)).toBe(true);
    expect(supervised.selectedRoute).not.toContain("Supervisor");
  });

  it("still authorizes by identity after the Supervisor pass", async () => {
    const supervised = await pipeline(true);
    const currentStep = supervised.selectedRoute[0];
    expect(
      canActOnStep(
        { id: 42, roles: [], approval_level: null, department: "QA" },
        { current_step: currentStep, department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(true);
    // The department Supervisor was never inserted, so they cannot act.
    expect(
      canActOnStep(
        { id: 5, roles: [], approval_level: "Supervisor", department: "IT" },
        { current_step: currentStep, department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  it("keeps the Q22 MD gate anchored on the first picked person, not on a Supervisor", async () => {
    const supervised = await pipeline(true);
    const result = evaluateApproveAction({
      memo: {
        id: 1,
        memo_no: "EM-2026-900",
        status: "pending",
        current_step: supervised.selectedRoute[0],
        revision_no: 0,
        selected_route_json: JSON.stringify(supervised.selectedRoute),
        deleted_at: null,
        department_name: "IT",
        requester_user_id: 99,
        requires_md_review: true,
        md_review_status: null,
        md_review_resume_step: null,
      },
      actor: {
        id: 42,
        first_name: "สมชาย",
        last_name: "ใจดี",
        roles: [],
        approval_level: null,
        department: "IT",
        status: "active",
      },
      pendingReadCount: 0,
      source: "web",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.memoUpdate.current_step).toBe("Managing Director");
      expect(result.payload.memoUpdate.md_review_resume_step).toBe("person:2#7");
    }
  });

  it("keeps Q23 in force for the non-final person after the Supervisor pass", async () => {
    const supervised = await pipeline(true);
    const result = evaluateRejectAction({
      memo: {
        id: 1,
        memo_no: "EM-2026-901",
        status: "pending",
        current_step: supervised.selectedRoute[0],
        revision_no: 0,
        selected_route_json: JSON.stringify(supervised.selectedRoute),
        deleted_at: null,
        department_name: "IT",
        requester_user_id: 99,
        requires_md_review: false,
        md_review_status: null,
        md_review_resume_step: null,
      },
      actor: {
        id: 42,
        first_name: "สมชาย",
        last_name: "ใจดี",
        roles: [],
        approval_level: null,
        department: "IT",
        status: "active",
      },
      disposition: "close",
      reason: "ไม่เอา",
      source: "web",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
