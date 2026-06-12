import { describe, expect, it, vi } from "vitest";
import { consumeApproveActionToken } from "./actions";
import type { Pool } from "mysql2/promise";

function makePoolSuccess(memoNo: string, userId: number): Pool {
  return {
    query: vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([[{ user_id: userId, memo_no: memoNo }], undefined]),
  } as unknown as Pool;
}

function makePoolFailed(): Pool {
  return {
    query: vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }, undefined]),
  } as unknown as Pool;
}

describe("consumeApproveActionToken", () => {
  it("returns memoNo and userId when atomic UPDATE succeeds", async () => {
    expect(await consumeApproveActionToken(1, 123456n, makePoolSuccess("EM-2026-001", 7))).toEqual({ memoNo: "EM-2026-001", userId: 7 });
  });
  // affectedRows=0 covers: not found, already used, expired, wrong telegram_user_id — SQL handles all atomically
  it("returns null when token is not found, used, expired, or wrong telegram_user_id", async () => {
    expect(await consumeApproveActionToken(99, 1n, makePoolFailed())).toBeNull();
  });
});
