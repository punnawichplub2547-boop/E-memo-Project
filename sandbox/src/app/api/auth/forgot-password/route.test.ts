import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db-users", () => ({ findUserByEmail: vi.fn() }));
vi.mock("@/lib/password-reset", () => ({ createPasswordResetToken: vi.fn() }));
vi.mock("@/lib/email/client", () => ({ sendEmailMessage: vi.fn() }));

import { POST } from "./route";
import { findUserByEmail } from "@/lib/db-users";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmailMessage } from "@/lib/email/client";

const ACTIVE_USER = {
  id: 7,
  email: "someone@car-1996.com",
  first_name: "Som",
  last_name: "One",
  status: "active",
};

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findUserByEmail).mockResolvedValue(ACTIVE_USER as never);
  vi.mocked(createPasswordResetToken).mockResolvedValue("RAWTOKEN");
  vi.mocked(sendEmailMessage).mockResolvedValue({ messageId: "m1" });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns 400 when no email is provided", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(vi.mocked(createPasswordResetToken)).not.toHaveBeenCalled();
  });

  it("returns 200 without issuing a token when the email has no account (no enumeration)", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    const res = await POST(makeReq({ email: "ghost@car-1996.com" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(createPasswordResetToken)).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmailMessage)).not.toHaveBeenCalled();
  });

  it("returns 200 without issuing a token when the account is not active", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue({ ...ACTIVE_USER, status: "pending" } as never);
    const res = await POST(makeReq({ email: ACTIVE_USER.email }));
    expect(res.status).toBe(200);
    expect(vi.mocked(createPasswordResetToken)).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmailMessage)).not.toHaveBeenCalled();
  });

  it("issues a token and emails a reset link for an active account", async () => {
    const res = await POST(makeReq({ email: " SomeOne@CAR-1996.com " }));
    expect(res.status).toBe(200);
    expect(vi.mocked(createPasswordResetToken)).toHaveBeenCalledWith(7);
    const msg = vi.mocked(sendEmailMessage).mock.calls[0][0];
    expect(msg.to).toBe("someone@car-1996.com");
    expect(msg.text).toContain("reset-password?token=RAWTOKEN");
  });
});
