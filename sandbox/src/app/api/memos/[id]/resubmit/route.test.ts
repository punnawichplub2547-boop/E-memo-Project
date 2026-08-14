import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getActiveSessionUserFromToken: vi.fn() }));
vi.mock("@/lib/auth-jwt", () => ({ COOKIE_NAME: "em-session" }));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));
vi.mock("@/lib/notify-memo-event", () => ({ notifyMemoEvent: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

const execute = vi.fn();
const commit = vi.fn();
const rollback = vi.fn();

/**
 * `memos.selected_route_json` is a MySQL `JSON` column, so mysql2 hands the driver's
 * already-parsed JavaScript array back — NOT the raw text. A route that calls
 * `JSON.parse()` on it a second time coerces the array to "Manager / Top Section"
 * and throws SyntaxError, which the catch-all turns into a 500. These fixtures use
 * the array shape on purpose: it is what production actually returns.
 */
function memoRow(over: Record<string, unknown> = {}) {
  return {
    id: 11,
    requester_name: "ผู้ดูแลระบบ E-Memo",
    requester_user_id: 7,
    status: "returned",
    reject_disposition: null,
    revision_no: 0,
    selected_route_json: ["Manager / Top Section", "General Manager"],
    requires_md_review: 0,
    return_to_step: null,
    ...over,
  };
}

function session(over: Record<string, unknown> = {}) {
  return {
    userId: 7,
    firstName: "ผู้ดูแลระบบ",
    lastName: "E-Memo",
    roles: ["requester"],
    department: "IT",
    ...over,
  };
}

function post(): NextRequest {
  return new NextRequest("http://localhost/api/memos/EM-2026-011/resubmit", {
    method: "POST",
    body: JSON.stringify({
      source: "return",
      returnReason: "เอกสารไม่ครบ",
      rejectReason: null,
      revisionNote: null,
      oldSubmittedAt: "01 Jun 2026 09:00",
      snapshotJson: "{}",
      readRecipients: [],
      updatedAt: "02 Jun 2026 09:00",
    }),
    headers: { "content-type": "application/json", cookie: "em-session=token" },
  });
}

const params = Promise.resolve({ id: "EM-2026-011" });

function updateCall() {
  return execute.mock.calls.find((c) => String(c[0]).includes("UPDATE memos SET"));
}

beforeEach(() => {
  vi.clearAllMocks();
  commit.mockResolvedValue(undefined);
  rollback.mockResolvedValue(undefined);
  execute.mockResolvedValue([[], []]);
  const connection = { execute, beginTransaction: vi.fn(), commit, rollback, release: vi.fn() };
  vi.mocked(getDbPool).mockReturnValue({ getConnection: vi.fn().mockResolvedValue(connection) } as never);
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(session() as never);
});

describe("POST /api/memos/[id]/resubmit — route JSON already parsed by mysql2", () => {
  it("resubmits successfully when the driver returns selected_route_json as an array", async () => {
    execute.mockResolvedValueOnce([[memoRow()], []]);

    const response = await POST(post(), { params });

    expect(response.status).toBe(200);
    expect(commit).toHaveBeenCalled();
  });

  it("restarts at the first step of the route rather than the hardcoded fallback", async () => {
    execute.mockResolvedValueOnce([[memoRow({ selected_route_json: ["Supervisor", "General Manager"] })], []]);

    await POST(post(), { params });

    // current_step is the 2nd bound parameter of the UPDATE
    expect(updateCall()?.[1][1]).toBe("Supervisor");
  });

  it("honours return_to_step when it is a member of the array-shaped route", async () => {
    execute.mockResolvedValueOnce([
      [memoRow({ return_to_step: "General Manager" })],
      [],
    ]);

    await POST(post(), { params });

    expect(updateCall()?.[1][1]).toBe("General Manager");
  });

  it("still works when the column comes back as a JSON string (older drivers/configs)", async () => {
    execute.mockResolvedValueOnce([
      [memoRow({ selected_route_json: JSON.stringify(["Manager / Top Section", "General Manager"]) })],
      [],
    ]);

    const response = await POST(post(), { params });

    expect(response.status).toBe(200);
    expect(updateCall()?.[1][1]).toBe("Manager / Top Section");
  });

  it("falls back to Manager / Top Section when the route is unusable", async () => {
    execute.mockResolvedValueOnce([[memoRow({ selected_route_json: null })], []]);

    await POST(post(), { params });

    expect(updateCall()?.[1][1]).toBe("Manager / Top Section");
  });
});
