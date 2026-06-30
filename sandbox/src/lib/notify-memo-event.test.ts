import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { computeReadNotifyRecipients, computeWatcherRecipients, getChatIds, getPendingReadLabels, getUserEmails, sendEmailAndTrack } from "./notify-memo-event";

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

describe("computeReadNotifyRecipients", () => {
  it("dedups the resolved read-recipient ids", () => {
    const r = computeReadNotifyRecipients({ readRecipientIds: [2, 3, 2], actorId: null });
    expect(r.sort()).toEqual([2, 3]);
  });
  it("excludes the submitting actor (no 'please read' to your own memo)", () => {
    const r = computeReadNotifyRecipients({ readRecipientIds: [5, 7], actorId: 5 });
    expect(r).toEqual([7]);
  });
  it("returns empty when there are no read recipients", () => {
    expect(computeReadNotifyRecipients({ readRecipientIds: [], actorId: 9 })).toEqual([]);
  });
});

describe("getPendingReadLabels", () => {
  it("queries pending read_actions for the memo + revision and returns the labels", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return [[{ recipient_name: "สมชาย ขายจริง" }, { recipient_name: "qa@car-1996.com" }], undefined];
      },
    } as unknown as Pool;
    const labels = await getPendingReadLabels(pool, 7, 2);
    expect(labels).toEqual(["สมชาย ขายจริง", "qa@car-1996.com"]);
    expect(calls[0].sql).toContain("status = 'pending'");
    expect(calls[0].params).toEqual([7, 2]);
  });
  it("drops empty labels", async () => {
    const pool = {
      query: async () => [[{ recipient_name: "" }, { recipient_name: "ok@car-1996.com" }], undefined],
    } as unknown as Pool;
    expect(await getPendingReadLabels(pool, 1, 1)).toEqual(["ok@car-1996.com"]);
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

describe("getUserEmails", () => {
  it("returns active user email addresses and skips missing ids", async () => {
    const map = await getUserEmails(
      chatPool([
        { id: 1, email: "a@car-1996.com" },
        { id: 3, email: "c@car-1996.com" },
      ]),
      [1, 2, 3],
    );
    expect(map.get(1)).toBe("a@car-1996.com");
    expect(map.has(2)).toBe(false);
    expect(map.get(3)).toBe("c@car-1996.com");
  });

  it("returns an empty map for no user ids without querying", async () => {
    const pool = {
      query: async () => {
        throw new Error("should not query");
      },
    } as unknown as Pool;
    await expect(getUserEmails(pool, [])).resolves.toEqual(new Map());
  });
});

describe("sendEmailAndTrack", () => {
  function trackingPool() {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return [{ affectedRows: 1 }, undefined];
      },
    } as unknown as Pool;
    return { pool, calls };
  }

  it("creates an email delivery row and marks it sent when SMTP succeeds", async () => {
    const { pool, calls } = trackingPool();
    await sendEmailAndTrack(
      pool,
      77,
      "approver@car-1996.com",
      "Subject",
      "Body",
      undefined,
      async () => ({ messageId: "email-1" }),
    );

    expect(calls[0].sql).toContain("notification_deliveries");
    expect(calls[0].sql).toContain("'email'");
    expect(calls[1].sql).toContain("UPDATE notification_deliveries");
    expect(calls[1].params[0]).toBe("sent");
    expect(calls[1].params[1]).toBe("email-1");
    expect(calls[1].params[5]).toBe(77);
    expect(calls[1].params[6]).toBe("email");
  });

  it("marks email delivery failed when SMTP does not return a result", async () => {
    const { pool, calls } = trackingPool();
    await sendEmailAndTrack(
      pool,
      78,
      "approver@car-1996.com",
      "Subject",
      "Body",
      undefined,
      async () => null,
    );

    expect(calls[1].params[0]).toBe("failed");
    expect(calls[1].params[1]).toBeNull();
    expect(calls[1].params[6]).toBe("email");
  });
});
