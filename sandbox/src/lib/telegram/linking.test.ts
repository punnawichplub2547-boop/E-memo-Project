import { describe, expect, it, vi } from "vitest";
import { consumeLinkToken } from "./linking";
import type { Pool } from "mysql2/promise";

function makePoolSuccess(userId: number): Pool {
  return {
    query: vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([[{ user_id: userId }], undefined]),
  } as unknown as Pool;
}

function makePoolFailed(): Pool {
  return {
    query: vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }, undefined]),
  } as unknown as Pool;
}

describe("consumeLinkToken", () => {
  it("returns userId when atomic UPDATE succeeds", async () => {
    expect(await consumeLinkToken("abc", makePoolSuccess(42))).toEqual({ userId: 42 });
  });
  // affectedRows=0 covers: not found, already used, expired — SQL handles all three atomically
  it("returns null when token is not found, already used, or expired", async () => {
    expect(await consumeLinkToken("bad", makePoolFailed())).toBeNull();
  });
});
