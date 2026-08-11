import { describe, expect, it } from "vitest";
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

// Two queries can reach the pool: the active-only lookup that builds the route, and
// (only on the failure path) a status-agnostic name lookup used for the error text.
function fakePool(users: UserRow[], allUsers: UserRow[] = users): Pool {
  return {
    query: async (sql: string, params: unknown[]) => {
      const wanted = params[0] as number[];
      const source = sql.includes("status = 'active'") ? users : allUsers;
      return [source.filter((u) => wanted.includes(u.id)), undefined];
    },
  } as unknown as Pool;
}

const users: UserRow[] = [
  { id: 42, first_name: "สมชาย", last_name: "ใจดี", approval_level: "Manager / Top Section", department: "IT" },
  { id: 7, first_name: "สุภาพร", last_name: "เจริญสุข", approval_level: "General Manager", department: "PD" },
];

async function resolveOk(pool: Pool, requested: unknown) {
  const result = await resolveCustomRouteFromRequest(pool, requested);
  expect(result.status).toBe("ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return result;
}

describe("resolveCustomRouteFromRequest", () => {
  it("builds tokens and a name snapshot from the DB, preserving the requested order", async () => {
    const result = await resolveOk(fakePool(users), [{ userId: 7 }, { userId: 42 }]);
    expect(result.route).toEqual(["person:1#7", "person:2#42"]);
    expect(result.approvers[0]).toEqual({
      stepKey: "person:1#7",
      userId: 7,
      name: "สุภาพร เจริญสุข",
      approvalLevel: "General Manager",
      department: "PD",
    });
  });

  it("ignores client-supplied names and levels entirely", async () => {
    const result = await resolveOk(fakePool(users), [
      { userId: 42, name: "ปลอม ปลอม", approvalLevel: "Managing Director", stepKey: "person:9#1" },
    ]);
    expect(result.approvers[0].name).toBe("สมชาย ใจดี");
    expect(result.approvers[0].approvalLevel).toBe("Manager / Top Section");
    expect(result.route).toEqual(["person:1#42"]);
  });

  // Silently dropping back to the Book1 level route would send the document down a
  // completely different chain of people than the requester chose, with nothing on
  // screen to say so. Refusing the submit is the safer failure.
  it("reports the inactive person by name instead of falling back to the level route", async () => {
    const withInactive = [
      ...users,
      { id: 55, first_name: "อดีต", last_name: "พนักงาน", approval_level: null, department: "IT" },
    ];
    const result = await resolveCustomRouteFromRequest(
      fakePool(users, withInactive),
      [{ userId: 42 }, { userId: 55 }],
    );
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("unreachable");
    expect(result.message).toContain("อดีต พนักงาน");
    expect(result.message).toContain("เลือกผู้อนุมัติใหม่");
    // The people who ARE fine must not be named as the problem.
    expect(result.message).not.toContain("สมชาย ใจดี");
  });

  it("names every unavailable person, not just the first", async () => {
    const withInactive = [
      ...users,
      { id: 55, first_name: "อดีต", last_name: "พนักงาน", approval_level: null, department: "IT" },
      { id: 56, first_name: "ลาออก", last_name: "ไปแล้ว", approval_level: null, department: "PD" },
    ];
    const result = await resolveCustomRouteFromRequest(
      fakePool(users, withInactive),
      [{ userId: 55 }, { userId: 42 }, { userId: 56 }],
    );
    if (result.status !== "invalid") throw new Error("expected invalid");
    expect(result.message).toContain("อดีต พนักงาน");
    expect(result.message).toContain("ลาออก ไปแล้ว");
  });

  it("falls back to the user id when the person no longer exists at all", async () => {
    const result = await resolveCustomRouteFromRequest(fakePool(users), [{ userId: 42 }, { userId: 404 }]);
    if (result.status !== "invalid") throw new Error("expected invalid");
    expect(result.message).toContain("404");
  });

  it("reports a malformed approver list rather than routing by Book1 behind the user's back", async () => {
    for (const bad of [[{ userId: "42" }], [{ userId: 0 }], [null]]) {
      const result = await resolveCustomRouteFromRequest(fakePool(users), bad);
      expect(result.status).toBe("invalid");
    }
  });

  // Backward compatibility: a request that never asked for a custom route must keep
  // taking the classic Book1 path, never a 400.
  it("reports 'none' for an absent, empty, or non-array customRoute", async () => {
    expect((await resolveCustomRouteFromRequest(fakePool(users), undefined)).status).toBe("none");
    expect((await resolveCustomRouteFromRequest(fakePool(users), null)).status).toBe("none");
    expect((await resolveCustomRouteFromRequest(fakePool(users), [])).status).toBe("none");
    expect((await resolveCustomRouteFromRequest(fakePool(users), "nope")).status).toBe("none");
  });

  it("keeps a person picked twice as two distinct steps", async () => {
    const result = await resolveOk(fakePool(users), [
      { userId: 42 },
      { userId: 7 },
      { userId: 42 },
    ]);
    expect(result.route).toEqual(["person:1#42", "person:2#7", "person:3#42"]);
  });

  it("only ever builds the route from active users", async () => {
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
    expect(calls).toHaveLength(1); // no second query on the happy path
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
    expect(custom.status).toBe("ok");
    if (custom.status !== "ok") throw new Error("unreachable");
    const supervised = applySupervisorRouting(custom.route, custom.route, hasSupervisor);
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
