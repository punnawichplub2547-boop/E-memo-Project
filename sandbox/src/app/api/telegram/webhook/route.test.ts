import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ getDbPool: vi.fn(() => ({})) }));
vi.mock("@/lib/db-users", () => ({ findUserById: vi.fn() }));
vi.mock("@/lib/telegram/client", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(null),
  answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  escHtml: (s: string) => s,
}));
vi.mock("@/lib/telegram/linking", () => ({
  consumeLinkToken: vi.fn().mockResolvedValue(null),
  upsertTelegramAccount: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/telegram/actions", () => ({
  consumeApproveActionToken: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/workflow-actions", () => ({
  approveMemoAction: vi.fn().mockResolvedValue({ ok: true }),
  WorkflowActionError: class WorkflowActionError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
  },
}));

import { POST } from "./route";
import { consumeLinkToken } from "@/lib/telegram/linking";
import { consumeApproveActionToken } from "@/lib/telegram/actions";
import { answerCallbackQuery } from "@/lib/telegram/client";

const SECRET = "test-webhook-secret-32-chars-xxxx";

function makeReq(body: unknown, secret?: string, extraHeaders?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret !== undefined ? { "x-telegram-bot-api-secret-token": secret } : {}),
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRET);
  vi.clearAllMocks();
});

describe("secret verification", () => {
  it("returns 403 when secret header is absent", async () => {
    expect((await POST(makeReq({}))).status).toBe(403);
  });

  it("returns 403 when secret is wrong", async () => {
    expect((await POST(makeReq({}, "wrong-secret-32-chars-padding-xx"))).status).toBe(403);
  });

  it("returns 403 when TELEGRAM_WEBHOOK_SECRET env is not set", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await POST(makeReq({}, SECRET))).status).toBe(403);
  });

  it("returns 200 with correct secret", async () => {
    expect((await POST(makeReq({}, SECRET))).status).toBe(200);
  });
});

describe("CF-Connecting-IP allowlist", () => {
  it("returns 403 when CF-Connecting-IP is not a Telegram IP (even with valid secret)", async () => {
    const res = await POST(makeReq({}, SECRET, { "cf-connecting-ip": "8.8.8.8" }));
    expect(res.status).toBe(403);
  });

  it("allows a request from a Telegram IP with a valid secret", async () => {
    const res = await POST(makeReq({}, SECRET, { "cf-connecting-ip": "149.154.167.41" }));
    expect(res.status).toBe(200);
  });

  it("skips the IP check when CF-Connecting-IP is absent (dev/local)", async () => {
    const res = await POST(makeReq({}, SECRET));
    expect(res.status).toBe(200);
  });
});

describe("handler robustness", () => {
  it("returns 200 on empty update (no crash)", async () => {
    const res = await POST(makeReq({}, SECRET));
    expect(res.status).toBe(200);
  });

  it("returns 200 even when internal handler throws unexpectedly", async () => {
    vi.mocked(consumeLinkToken).mockRejectedValueOnce(new Error("DB down"));
    const body = {
      message: { from: { id: 1 }, chat: { id: 1 }, text: "/start sometoken" },
    };
    const res = await POST(makeReq(body, SECRET));
    expect(res.status).toBe(200);
  });
});

describe("/start account linking", () => {
  it("returns 200 and handles expired link token gracefully", async () => {
    vi.mocked(consumeLinkToken).mockResolvedValueOnce(null);
    const body = {
      message: { from: { id: 111, username: "u", first_name: "A", last_name: "B" }, chat: { id: 111 }, text: "/start expiredtoken" },
    };
    const res = await POST(makeReq(body, SECRET));
    expect(res.status).toBe(200);
  });
});

describe("approve callback", () => {
  it("rejects expired/wrong-user action token and returns 200", async () => {
    vi.mocked(consumeApproveActionToken).mockResolvedValueOnce(null);
    const body = {
      callback_query: { id: "cq1", from: { id: 999 }, message: { chat: { id: 999 } }, data: "approve:42" },
    };
    const res = await POST(makeReq(body, SECRET));
    expect(res.status).toBe(200);
    expect(vi.mocked(answerCallbackQuery)).toHaveBeenCalledWith("cq1", expect.stringContaining("หมดอายุ"), true);
  });

  it("does not approve when token already consumed (double-tap protection)", async () => {
    // First consume returns null — token already used
    vi.mocked(consumeApproveActionToken).mockResolvedValueOnce(null);
    const body = {
      callback_query: { id: "cq2", from: { id: 123 }, message: { chat: { id: 123 } }, data: "approve:99" },
    };
    await POST(makeReq(body, SECRET));
    // approveMemoAction must NOT have been called
    const { approveMemoAction } = await import("@/lib/workflow-actions");
    expect(vi.mocked(approveMemoAction)).not.toHaveBeenCalled();
  });

  it("returns 200 on unknown callback data", async () => {
    const body = {
      callback_query: { id: "cq3", from: { id: 1 }, message: { chat: { id: 1 } }, data: "unknown:xyz" },
    };
    const res = await POST(makeReq(body, SECRET));
    expect(res.status).toBe(200);
    expect(vi.mocked(answerCallbackQuery)).toHaveBeenCalledWith("cq3", "ไม่รู้จักคำสั่งนี้");
  });
});
