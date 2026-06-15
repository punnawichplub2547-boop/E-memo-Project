import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { computeWatcherRecipients, getChatIds } from "./notify-memo-event";

function chatPool(rows: unknown[]): Pool {
  return {
    query: async () => [rows, undefined],
  } as unknown as Pool;
}

describe("computeWatcherRecipients", () => {
  it("unions requester + cc and dedups", () => {
    const r = computeWatcherRecipients({ requesterId: 1, ccIds: [2, 3, 2], actorId: null, excludeActor: false });
    expect(r.sort()).toEqual([1, 2, 3]);
  });
  it("drops a null requester", () => {
    expect(computeWatcherRecipients({ requesterId: null, ccIds: [5], actorId: null, excludeActor: true })).toEqual([5]);
  });
  it("excludes the actor when excludeActor is true", () => {
    const r = computeWatcherRecipients({ requesterId: 1, ccIds: [2, 3], actorId: 2, excludeActor: true });
    expect(r.sort()).toEqual([1, 3]);
  });
  it("keeps the actor when excludeActor is false (submitted confirmation)", () => {
    const r = computeWatcherRecipients({ requesterId: 7, ccIds: [], actorId: 7, excludeActor: false });
    expect(r).toEqual([7]);
  });
  it("returns empty when nobody resolves", () => {
    expect(computeWatcherRecipients({ requesterId: null, ccIds: [], actorId: 9, excludeActor: true })).toEqual([]);
  });
  it("drops excludeIds (approver who is also a CC is not doubled up)", () => {
    const r = computeWatcherRecipients({ requesterId: 1, ccIds: [2, 3], actorId: null, excludeActor: false, excludeIds: [3] });
    expect(r.sort()).toEqual([1, 2]);
  });
});

describe("getChatIds", () => {
  it("returns an empty map for no user ids without querying", async () => {
    const map = await getChatIds(chatPool([]), []);
    expect(map.size).toBe(0);
  });
  it("maps valid chat ids and skips null/empty/non-numeric without throwing", async () => {
    const map = await getChatIds(
      chatPool([
        { user_id: 1, telegram_chat_id: "12345" },
        { user_id: 2, telegram_chat_id: null },
        { user_id: 3, telegram_chat_id: "" },
        { user_id: 4, telegram_chat_id: "not-a-number" },
      ]),
      [1, 2, 3, 4],
    );
    expect(map.get(1)).toBe(12345n);
    expect(map.has(2)).toBe(false);
    expect(map.has(3)).toBe(false);
    expect(map.has(4)).toBe(false);
  });
});
