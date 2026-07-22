import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db-users", () => ({
  updateUserRoles: vi.fn(),
  updateUserStatus: vi.fn(),
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  findActiveUsersByApprovalLevel: vi.fn(),
}));

import { PUT } from "./roles/route";
import { POST as approve } from "./approve/route";
import { POST as reject } from "./reject/route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { updateUserRoles, approveUser, rejectUser } from "@/lib/db-users";

const ADMIN = { userId: 1, firstName: "A", lastName: "B", roles: ["admin"] };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(ADMIN as never);
});

describe("admin user routes reject non-integer id with 400 (no DB write)", () => {
  it("PUT roles → 400 on id='abc'", async () => {
    const res = await PUT(req("http://localhost/api/admin/users/abc/roles", { roles: ["requester"] }), ctx("abc"));
    expect(res.status).toBe(400);
    expect(vi.mocked(updateUserRoles)).not.toHaveBeenCalled();
  });

  it("POST approve → 400 on id='abc'", async () => {
    const res = await approve(req("http://localhost/api/admin/users/abc/approve", { roles: ["requester"] }), ctx("abc"));
    expect(res.status).toBe(400);
    expect(vi.mocked(approveUser)).not.toHaveBeenCalled();
  });

  it("POST reject → 400 on id='0'", async () => {
    const res = await reject(req("http://localhost/api/admin/users/0/reject", {}), ctx("0"));
    expect(res.status).toBe(400);
    expect(vi.mocked(rejectUser)).not.toHaveBeenCalled();
  });
});
