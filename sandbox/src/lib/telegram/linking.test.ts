import { describe, expect, it, vi } from "vitest";
import { consumeLinkToken } from "./linking";
import type { Pool } from "mysql2/promise";

const FUTURE = new Date(Date.now() + 60_000).toISOString().replace("T", " ").slice(0, 19);

function makePool(tokenRow: object | null): Pool {
  return {
    query: vi.fn()
      .mockResolvedValueOnce([[...(tokenRow ? [tokenRow] : [])], undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined]),
  } as unknown as Pool;
}

describe("consumeLinkToken", () => {
  it("returns userId for valid unused unexpired token", async () => {
    const pool = makePool({ id: 1, user_id: 42, expires_at: FUTURE, used_at: null });
    expect(await consumeLinkToken("abc", pool)).toEqual({ userId: 42 });
  });
  it("returns null when not found", async () => {
    expect(await consumeLinkToken("bad", makePool(null))).toBeNull();
  });
  it("returns null when already used", async () => {
    const pool = makePool({ id: 1, user_id: 5, expires_at: FUTURE, used_at: "2026-06-12 09:00:00" });
    expect(await consumeLinkToken("abc", pool)).toBeNull();
  });
  it("returns null when expired", async () => {
    const pool = makePool({ id: 1, user_id: 5, expires_at: "2020-01-01 00:00:00", used_at: null });
    expect(await consumeLinkToken("abc", pool)).toBeNull();
  });
});
