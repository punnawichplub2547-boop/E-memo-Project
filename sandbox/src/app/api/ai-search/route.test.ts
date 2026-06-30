import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/ai/groq", () => ({ callGroq: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { callGroq } from "@/lib/ai/groq";

const USER = { userId: 1, firstName: "A", lastName: "B", roles: ["requester"] };
function req(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/ai-search", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
});

describe("POST /api/ai-search auth guard", () => {
  it("401 when no session, and never calls the AI provider", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await POST(req({ query: "x", memos: [{ id: "1" }] }));
    expect(res.status).toBe(401);
    expect(vi.mocked(callGroq)).not.toHaveBeenCalled();
  });

  it("passes the auth gate for an authenticated user", async () => {
    const res = await POST(req({ query: "x", memos: [{ id: "1" }] }));
    expect(res.status).not.toBe(401);
  });
});
