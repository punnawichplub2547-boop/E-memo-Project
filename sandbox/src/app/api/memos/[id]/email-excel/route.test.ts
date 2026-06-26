import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn(() => ({})) }));
vi.mock("@/lib/export/load-memo-export", () => ({ loadMemoForExport: vi.fn() }));
vi.mock("@/lib/memo-visibility", () => ({ isMemoVisibleTo: vi.fn(() => true) }));
vi.mock("@/lib/email/client", () => ({
  getEmailConfig: vi.fn(),
  sendEmailMessage: vi.fn(),
}));
vi.mock("@/lib/export/memo-excel", () => ({
  memoToExcelBuffer: vi.fn().mockResolvedValue(Buffer.from("xlsx-bytes")),
}));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { loadMemoForExport } from "@/lib/export/load-memo-export";
import { isMemoVisibleTo } from "@/lib/memo-visibility";
import { getEmailConfig, sendEmailMessage } from "@/lib/email/client";

const SESSION = { userId: 1, firstName: "A", lastName: "B", roles: ["requester"] };
const CONFIG = { host: "smtp", port: 587, secure: false, from: "E-Memo <x@x.com>" };

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/memos/EM-1/email-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "EM-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(SESSION as never);
  vi.mocked(loadMemoForExport).mockResolvedValue({ memo: { id: "EM-1", title: "T" } as never, signatures: [] });
  vi.mocked(isMemoVisibleTo).mockReturnValue(true);
  vi.mocked(getEmailConfig).mockReturnValue(CONFIG as never);
  vi.mocked(sendEmailMessage).mockResolvedValue({ messageId: "m1" });
});

describe("POST /api/memos/[id]/email-excel", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    expect((await POST(makeReq({ to: "a@x.com" }), ctx)).status).toBe(401);
  });

  it("returns 400 when the recipient list has no valid email", async () => {
    const res = await POST(makeReq({ to: "not-an-email" }), ctx);
    expect(res.status).toBe(400);
    expect(vi.mocked(sendEmailMessage)).not.toHaveBeenCalled();
  });

  it("returns 503 when email delivery is not configured", async () => {
    vi.mocked(getEmailConfig).mockReturnValue(null);
    expect((await POST(makeReq({ to: "a@x.com" }), ctx)).status).toBe(503);
  });

  it("returns 404 when the memo does not exist", async () => {
    vi.mocked(loadMemoForExport).mockResolvedValue(null);
    expect((await POST(makeReq({ to: "a@x.com" }), ctx)).status).toBe(404);
  });

  it("returns 403 when the memo is not visible to a non-admin", async () => {
    vi.mocked(isMemoVisibleTo).mockReturnValue(false);
    expect((await POST(makeReq({ to: "a@x.com" }), ctx)).status).toBe(403);
  });

  it("emails the memo Excel as an attachment, one message per recipient, and returns 200", async () => {
    const res = await POST(makeReq({ to: "a@x.com, b@y.com" }), ctx);
    expect(res.status).toBe(200);
    expect(vi.mocked(sendEmailMessage)).toHaveBeenCalledTimes(2);
    const firstArg = vi.mocked(sendEmailMessage).mock.calls[0][0];
    expect(firstArg.to).toBe("a@x.com");
    expect(firstArg.attachments?.[0].filename).toBe("memo-EM-1.xlsx");
    expect(firstArg.attachments?.[0].content).toBeInstanceOf(Buffer);
  });
});
