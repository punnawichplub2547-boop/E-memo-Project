import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/ai/thaillm", () => ({ callThaiLLM: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";

const USER = { userId: 1, firstName: "A", lastName: "B", roles: ["requester"] };
function req(): NextRequest {
  return new NextRequest("http://localhost/api/pdf-extract", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
});

describe("POST /api/pdf-extract auth guard", () => {
  it("401 when no session", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });
});
