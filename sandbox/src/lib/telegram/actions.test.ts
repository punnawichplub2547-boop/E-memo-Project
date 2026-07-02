import { describe, expect, it, vi } from "vitest";
import {
  consumeApproveActionToken,
  consumeReviewActionToken,
  createReviewConversationState,
  findActiveReviewConversationState,
  deleteReviewConversationState,
} from "./actions";
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

function makeReviewPoolSuccess(memoNo: string, userId: number, memoId: number): Pool {
  return {
    query: vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([[{ user_id: userId, memo_id: memoId, memo_no: memoNo }], undefined]),
  } as unknown as Pool;
}

function makeReviewPoolFailed(): Pool {
  return {
    query: vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }, undefined]),
  } as unknown as Pool;
}

describe("consumeReviewActionToken", () => {
  it("returns memoNo, userId, and memoId when atomic UPDATE succeeds", async () => {
    expect(
      await consumeReviewActionToken(1, 123456n, "review_no_objection", makeReviewPoolSuccess("EM-2026-001", 7, 42)),
    ).toEqual({ memoNo: "EM-2026-001", userId: 7, memoId: 42 });
  });
  it("returns null when token is not found, used, expired, or wrong telegram_user_id", async () => {
    expect(await consumeReviewActionToken(99, 1n, "review_escalate", makeReviewPoolFailed())).toBeNull();
  });
});

describe("createReviewConversationState", () => {
  it("inserts a row and returns its id", async () => {
    const pool = {
      query: vi.fn().mockResolvedValueOnce([{ insertId: 55 }, undefined]),
    } as unknown as Pool;
    const result = await createReviewConversationState({
      telegramUserId: 123456n, userId: 7, memoId: 42, actionType: "review_comment", pool,
    });
    expect(result).toEqual({ id: 55 });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO telegram_conversation_states"),
      expect.arrayContaining([123456n.toString(), 7, 42, "review_comment", "awaiting_text"]),
    );
  });
});

describe("findActiveReviewConversationState", () => {
  it("returns the state when an active row exists", async () => {
    const pool = {
      query: vi.fn().mockResolvedValueOnce([
        [{ id: 55, user_id: 7, memo_id: 42, memo_no: "EM-2026-001", action_type: "review_comment" }],
        undefined,
      ]),
    } as unknown as Pool;
    expect(await findActiveReviewConversationState(123456n, pool)).toEqual({
      id: 55, userId: 7, memoId: 42, memoNo: "EM-2026-001", actionType: "review_comment",
    });
  });
  it("returns null when no active row exists", async () => {
    const pool = { query: vi.fn().mockResolvedValueOnce([[], undefined]) } as unknown as Pool;
    expect(await findActiveReviewConversationState(999n, pool)).toBeNull();
  });
});

describe("deleteReviewConversationState", () => {
  it("deletes scoped to id and telegram_user_id", async () => {
    const pool = { query: vi.fn().mockResolvedValueOnce([{ affectedRows: 1 }, undefined]) } as unknown as Pool;
    await deleteReviewConversationState(55, 123456n, pool);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM telegram_conversation_states"),
      [55, "123456"],
    );
  });
});
