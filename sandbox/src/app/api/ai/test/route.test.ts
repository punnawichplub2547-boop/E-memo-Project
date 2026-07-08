import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/ai/thaillm", () => ({ callThaiLLM: vi.fn() }));
vi.mock("@/lib/ai/groq", () => ({ callGroq: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { callThaiLLM } from "@/lib/ai/thaillm";
import { callGroq } from "@/lib/ai/groq";

const USER = { userId: 1, firstName: "A", lastName: "B", roles: ["requester"] };
function req(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/ai/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
});

describe("POST /api/ai/test auth guard", () => {
  it("401 when no session, and never calls any AI provider", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await POST(req({ provider: "thaillm", prompt: "hello" }));
    expect(res.status).toBe(401);
    expect(vi.mocked(callThaiLLM)).not.toHaveBeenCalled();
    expect(vi.mocked(callGroq)).not.toHaveBeenCalled();
  });

  it("passes the auth gate for an authenticated user", async () => {
    vi.mocked(callThaiLLM).mockResolvedValue({ text: "ok", usage: undefined } as never);
    const res = await POST(req({ provider: "thaillm", prompt: "hello" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(callThaiLLM)).toHaveBeenCalledTimes(1);
  });
});
