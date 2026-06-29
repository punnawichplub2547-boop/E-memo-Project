import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/password-reset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/password-reset")>()),
  findResetTokenByRaw: vi.fn(),
  markResetTokenUsed: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/db-users", () => ({ updateUserPassword: vi.fn() }));

import { POST } from "./route";
import { findResetTokenByRaw, markResetTokenUsed } from "@/lib/password-reset";
import { hashPassword } from "@/lib/auth";
import { updateUserPassword } from "@/lib/db-users";

const FUTURE = "2999-01-01 00:00:00";
const PAST = "2000-01-01 00:00:00";

function usableToken() {
  return { id: 11, userId: 7, row: { expires_at: FUTURE, used_at: null } };
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findResetTokenByRaw).mockResolvedValue(usableToken());
  vi.mocked(markResetTokenUsed).mockResolvedValue(true);
  vi.mocked(hashPassword).mockResolvedValue("HASHED");
});

describe("POST /api/auth/reset-password", () => {
  it("returns 400 when token is missing", async () => {
    const res = await POST(makeReq({ password: "longenough1" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(updateUserPassword)).not.toHaveBeenCalled();
  });

  it("returns 400 when the new password is shorter than 8 chars", async () => {
    const res = await POST(makeReq({ token: "RAW", password: "short" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(updateUserPassword)).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is not found", async () => {
    vi.mocked(findResetTokenByRaw).mockResolvedValue(null);
    const res = await POST(makeReq({ token: "RAW", password: "longenough1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the token is expired", async () => {
    vi.mocked(findResetTokenByRaw).mockResolvedValue({ id: 11, userId: 7, row: { expires_at: PAST, used_at: null } });
    const res = await POST(makeReq({ token: "RAW", password: "longenough1" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(markResetTokenUsed)).not.toHaveBeenCalled();
  });

  it("returns 400 when the token was already used", async () => {
    vi.mocked(findResetTokenByRaw).mockResolvedValue({ id: 11, userId: 7, row: { expires_at: FUTURE, used_at: PAST } });
    const res = await POST(makeReq({ token: "RAW", password: "longenough1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the atomic consume loses the race (double submit)", async () => {
    vi.mocked(markResetTokenUsed).mockResolvedValue(false);
    const res = await POST(makeReq({ token: "RAW", password: "longenough1" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(updateUserPassword)).not.toHaveBeenCalled();
  });

  it("updates the password and returns 200 for a valid token", async () => {
    const res = await POST(makeReq({ token: "RAW", password: "longenough1" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(markResetTokenUsed)).toHaveBeenCalledWith(11);
    expect(vi.mocked(updateUserPassword)).toHaveBeenCalledWith(7, "HASHED");
  });
});
