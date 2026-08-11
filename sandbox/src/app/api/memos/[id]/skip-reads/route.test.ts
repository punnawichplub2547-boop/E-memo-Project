import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getActiveSessionUserFromToken: vi.fn() }));
vi.mock("@/lib/auth-jwt", () => ({ COOKIE_NAME: "em-session" }));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

const execute = vi.fn();
const commit = vi.fn();
const rollback = vi.fn();

type MemoRow = {
  id: number;
  current_step: string;
  status: string;
  revision_no: number;
  department_name: string;
  requester_user_id: number | null;
};

function memoRow(over: Partial<MemoRow> = {}): MemoRow {
  return {
    id: 11,
    current_step: "Manager / Top Section",
    status: "pending",
    revision_no: 0,
    department_name: "IT",
    requester_user_id: 99,
    ...over,
  };
}

function session(over: Record<string, unknown> = {}) {
  return {
    userId: 7,
    firstName: "สมชาย",
    lastName: "ใจดี",
    roles: ["manager"],
    department: "IT",
    approvalLevel: "Manager / Top Section",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  commit.mockResolvedValue(undefined);
  rollback.mockResolvedValue(undefined);
  const connection = { execute, beginTransaction: vi.fn(), commit, rollback, release: vi.fn() };
  vi.mocked(getDbPool).mockReturnValue({ getConnection: vi.fn().mockResolvedValue(connection) } as never);
});

function post(): NextRequest {
  return new NextRequest("http://localhost/api/memos/EM-2026-011/skip-reads", {
    method: "POST",
    body: JSON.stringify({
      recipients: ["สุภาพร เจริญสุข"],
      skipReason: "เร่งด่วน",
      revisionNo: 0,
      actedAt: "01 Jun 2026 09:00",
      actorName: null,
    }),
    headers: { "content-type": "application/json", cookie: "em-session=token" },
  });
}

const params = Promise.resolve({ id: "EM-2026-011" });

async function callWith(row: MemoRow, sessionUser: Record<string, unknown>) {
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(sessionUser as never);
  execute.mockResolvedValue([[row], undefined]);
  return POST(post(), { params });
}

// Skipping outstanding read acknowledgements is the emergency exit when a recipient
// will not press "read": evaluateApproveAction answers 409 while any read is pending,
// so an approver who cannot skip cannot move the memo at all. The old check compared
// session.approvalLevel to current_step, which a custom route's step ("person:2#6")
// can never equal — so on a per-person route the exit was shut for everyone, on every
// memo, while the UI still offered the button.
describe("POST /api/memos/[id]/skip-reads authorization", () => {
  it("lets the person named by the current custom step skip", async () => {
    const res = await callWith(
      memoRow({ current_step: "person:2#7" }),
      session({ approvalLevel: null, roles: ["requester"] }),
    );
    expect(res.status).toBe(200);
    expect(commit).toHaveBeenCalled();
  });

  it("refuses a different user on that custom step", async () => {
    const res = await callWith(memoRow({ current_step: "person:2#7" }), session({ userId: 8 }));
    expect(res.status).toBe(403);
    expect(commit).not.toHaveBeenCalled();
  });

  it("still lets the matching level approver skip", async () => {
    const res = await callWith(memoRow(), session());
    expect(res.status).toBe(200);
  });

  it("still refuses an approver whose level does not match the step", async () => {
    const res = await callWith(memoRow({ current_step: "Managing Director" }), session());
    expect(res.status).toBe(403);
  });

  // Same scoping as approve/return/reject: every department has a Manager sharing one
  // label, so the label alone must not authorize acting on another department's memo.
  it("refuses a Manager from another department", async () => {
    const res = await callWith(memoRow({ department_name: "PD" }), session());
    expect(res.status).toBe(403);
  });

  it("refuses the requester acting on their own memo", async () => {
    const res = await callWith(memoRow({ requester_user_id: 7 }), session());
    expect(res.status).toBe(403);
  });

  it("still lets an admin skip", async () => {
    const res = await callWith(
      memoRow({ current_step: "person:2#7" }),
      session({ userId: 8, roles: ["admin"], approvalLevel: null }),
    );
    expect(res.status).toBe(200);
  });
});
