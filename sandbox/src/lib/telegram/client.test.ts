import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerCallbackQuery, buildInlineKeyboard, sendTelegramMessage, sendTelegramPhoto } from "./client";

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

describe("sendTelegramPhoto", () => {
  it("posts multipart form data to sendPhoto — JSON cannot carry a file", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 }),
    );
    const result = await sendTelegramPhoto(123n, Buffer.from([1, 2, 3]), "a.png");
    expect(result).toEqual({ message_id: 7 });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:TEST/sendPhoto");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("chat_id")).toBe("123");

    // The whole point of this function is that a real file part reaches Telegram —
    // assert the "photo" part is an actual Blob/File carrying the right bytes and
    // filename, not just that some value exists under that key.
    const photoPart = (init.body as FormData).get("photo");
    expect(photoPart).toBeInstanceOf(Blob);
    const blob = photoPart as unknown as File;
    expect(blob.name).toBe("a.png");
    expect(blob.size).toBe(3);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("attaches caption and parse_mode when a caption is provided", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), { status: 200 }),
    );
    await sendTelegramPhoto(1n, Buffer.from([1]), "a.png", { caption: "hello" });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get("caption")).toBe("hello");
    expect(form.get("parse_mode")).toBe("HTML");
  });

  it("returns null and logs when Telegram rejects the photo", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error_code: 400, description: "PHOTO_INVALID_DIMENSIONS" }),
        { status: 200 },
      ),
    );
    await expect(sendTelegramPhoto(1n, Buffer.from([1]), "a.png")).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logged = errSpy.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("[telegram]");
    expect(logged).toContain("PHOTO_INVALID_DIMENSIONS");
  });

  it("returns null when the network throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(sendTelegramPhoto(1n, Buffer.from([1]), "a.png")).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logged = errSpy.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("[telegram]");
    expect(logged).toContain("offline");
  });
});
