import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));

import { GET } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";

const ADMIN = { userId: 1, firstName: "A", lastName: "B", roles: ["admin"] };
function req(): NextRequest {
  return new NextRequest("http://localhost/api/admin/status", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(ADMIN as never);
});

describe("GET /api/admin/status", () => {
  it("401 when no session and does not leak key presence", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).not.toHaveProperty("thaillm");
    expect(body).not.toHaveProperty("groq");
  });

  it("403 when authenticated but not admin", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue({ ...ADMIN, roles: ["requester"] } as never);
    expect((await GET(req())).status).toBe(403);
  });

  it("200 with key presence booleans for admin", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("thaillm");
    expect(body).toHaveProperty("groq");
  });
});
