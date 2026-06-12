import { describe, expect, it, vi } from "vitest";
import { consumeApproveActionToken } from "./actions";
import type { Pool } from "mysql2/promise";

const FUTURE = new Date(Date.now() + 60_000).toISOString().replace("T", " ").slice(0, 19);

function makePool(row: object | null): Pool {
  return {
    query: vi.fn()
      .mockResolvedValueOnce([[...(row ? [row] : [])], undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined]),
  } as unknown as Pool;
}

const validRow = { id: 1, memo_id: 5, memo_no: "EM-2026-001", user_id: 7, telegram_user_id_owner: "123456", expires_at: FUTURE, used_at: null };

describe("consumeApproveActionToken", () => {
  it("returns memoNo and userId for valid matching token", async () => {
    expect(await consumeApproveActionToken(1, 123456n, makePool(validRow))).toEqual({ memoNo: "EM-2026-001", userId: 7 });
  });
  it("returns null when not found", async () => {
    expect(await consumeApproveActionToken(99, 1n, makePool(null))).toBeNull();
  });
  it("returns null when telegram_user_id does not match", async () => {
    expect(await consumeApproveActionToken(1, 999n, makePool(validRow))).toBeNull();
  });
  it("returns null when already used", async () => {
    expect(await consumeApproveActionToken(1, 123456n, makePool({ ...validRow, used_at: "2026-06-12 09:00:00" }))).toBeNull();
  });
  it("returns null when expired", async () => {
    expect(await consumeApproveActionToken(1, 123456n, makePool({ ...validRow, expires_at: "2020-01-01 00:00:00" }))).toBeNull();
  });
});
