import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/ai/thaillm", () => ({ callThaiLLM: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { callThaiLLM } from "@/lib/ai/thaillm";

const USER = { userId: 1, firstName: "A", lastName: "B", roles: ["requester"] };
function req(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/ai-draft", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
});

describe("POST /api/ai-draft auth guard", () => {
  it("401 when no session, and never calls the AI provider", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(vi.mocked(callThaiLLM)).not.toHaveBeenCalled();
  });

  it("passes the auth gate for an authenticated user", async () => {
    // No THAILLM_API_KEY in test env → handler short-circuits to not_configured,
    // but the important part is it did NOT 401.
    const res = await POST(req({ category: "general-purchase", amount: 100, department: "IT", budgetStatus: "in-budget" }));
    expect(res.status).not.toBe(401);
  });
});
