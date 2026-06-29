import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

const ADMIN = { userId: 1, firstName: "Real", lastName: "Admin", roles: ["admin"] };

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/memos/EM-1/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "EM-1" }) };

let execute: ReturnType<typeof vi.fn>;
let connection: Record<string, unknown>;

function findInsertActorName(): unknown {
  const call = execute.mock.calls.find((c) => String(c[0]).includes("workflow_step_actions"));
  return call ? (call[1] as unknown[])[4] : undefined;
}

const VALID_BODY = {
  revisionNo: 0,
  deletedAt: "01 Jan 2026 10:00",
  actorName: "Spoofed Hacker",
  reason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(ADMIN as never);
  execute = vi.fn().mockResolvedValue([[{ id: 5 }]]);
  connection = {
    beginTransaction: vi.fn(),
    execute,
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  vi.mocked(getDbPool).mockReturnValue({
    getConnection: vi.fn().mockResolvedValue(connection),
  } as never);
});

describe("POST /api/memos/[id]/delete", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await POST(makeReq(VALID_BODY), ctx);
    expect(res.status).toBe(401);
    expect(vi.mocked(getDbPool)).not.toHaveBeenCalled();
  });

  it("returns 403 when the session is not an admin", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue({ ...ADMIN, roles: ["requester"] } as never);
    const res = await POST(makeReq(VALID_BODY), ctx);
    expect(res.status).toBe(403);
    expect(vi.mocked(getDbPool)).not.toHaveBeenCalled();
  });

  it("records the audit actor from the session, ignoring a spoofed actorName in the body", async () => {
    const res = await POST(makeReq(VALID_BODY), ctx);
    expect(res.status).toBe(200);
    expect(findInsertActorName()).toBe("Real Admin");
  });
});
