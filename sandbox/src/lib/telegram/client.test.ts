import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerCallbackQuery, buildInlineKeyboard, sendTelegramMessage } from "./client";

beforeEach(() => { vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:TEST"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("buildInlineKeyboard", () => {
  it("wraps rows in inline_keyboard", () => {
    expect(buildInlineKeyboard([[{ text: "OK", callback_data: "approve:1" }]])).toEqual({
      inline_keyboard: [[{ text: "OK", callback_data: "approve:1" }]],
    });
  });
});

describe("sendTelegramMessage", () => {
  it("POSTs to sendMessage and returns message_id", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }), { status: 200 }),
    );
    const result = await sendTelegramMessage(12345n, "test");
    expect(spy).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:TEST/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ message_id: 99 });
  });
  it("returns null on ok:false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 200 }),
    );
    await expect(sendTelegramMessage(1n, "x")).resolves.toBeNull();
  });
  it("returns null on network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net"));
    await expect(sendTelegramMessage(1n, "x")).resolves.toBeNull();
  });
  it("logs the API error description when Telegram rejects the send", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 400,
          description: "Bad Request: inline keyboard button URL 'http://localhost:3000/queue' is invalid",
        }),
        { status: 200 },
      ),
    );
    await sendTelegramMessage(1n, "x");
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logged = errSpy.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("[telegram]");
    expect(logged).toContain("inline keyboard button URL");
  });
  it("logs the thrown error on network failure", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    await sendTelegramMessage(1n, "x");
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logged = errSpy.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("[telegram]");
    expect(logged).toContain("ECONNREFUSED");
  });
});

describe("answerCallbackQuery", () => {
  it("POSTs to answerCallbackQuery", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await answerCallbackQuery("cq123", "done");
    expect(spy).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:TEST/answerCallbackQuery",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("does not throw on failure but logs the error", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));
    await expect(answerCallbackQuery("id", "text")).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0].map(String).join(" ")).toContain("[telegram]");
  });
});
