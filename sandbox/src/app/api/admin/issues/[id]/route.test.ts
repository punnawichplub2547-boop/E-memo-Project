import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn(() => ({})) }));
vi.mock("@/lib/issue-reports", () => ({ deleteIssueReport: vi.fn() }));

import { DELETE } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { deleteIssueReport } from "@/lib/issue-reports";

const ADMIN = { userId: 1, firstName: "A", lastName: "B", roles: ["admin"] };
function req(): NextRequest {
  return new NextRequest("http://localhost/api/admin/issues/7", { method: "DELETE" });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(ADMIN as never);
  vi.mocked(deleteIssueReport).mockResolvedValue(true);
});

describe("DELETE /api/admin/issues/[id]", () => {
  it("401 when no session", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    expect((await DELETE(req(), ctx("7"))).status).toBe(401);
  });
  it("403 when not admin", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue({ ...ADMIN, roles: ["requester"] } as never);
    expect((await DELETE(req(), ctx("7"))).status).toBe(403);
    expect(vi.mocked(deleteIssueReport)).not.toHaveBeenCalled();
  });
  it("400 on invalid id", async () => {
    expect((await DELETE(req(), ctx("abc"))).status).toBe(400);
  });
  it("200 and deletes when admin", async () => {
    const res = await DELETE(req(), ctx("7"));
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteIssueReport)).toHaveBeenCalledWith(expect.anything(), 7);
  });
});
