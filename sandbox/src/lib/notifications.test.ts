import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import {
  buildMemoNotificationText,
  buildMemoNotificationTitle,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  parseNotificationLimit,
} from "./notifications";

// Minimal fake pool that records each query() call and replays canned results in order.
function makeFakePool(results: unknown[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let i = 0;
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return [results[i++], undefined];
    },
  } as unknown as Pool;
  return { pool, calls };
}

const memo = { memoNo: "EM-2026-042", title: "ซื้อวัตถุดิบ", requesterName: "สมชาย", currentStep: "Managing Director" };

describe("buildMemoNotificationText", () => {
  it("pending approval includes all fields", () => {
    const t = buildMemoNotificationText("memo_pending_approval", memo);
    expect(t).toContain("EM-2026-042");
    expect(t).toContain("ซื้อวัตถุดิบ");
    expect(t).toContain("สมชาย");
    expect(t).toContain("Managing Director");
  });
  it("approved message contains อนุมัติ", () => {
    expect(buildMemoNotificationText("memo_approved", memo)).toContain("อนุมัติ");
  });
  it("returned message contains ส่งคืน", () => {
    expect(buildMemoNotificationText("memo_returned", memo)).toContain("ส่งคืน");
  });
  it("rejected message contains ปฏิเสธ", () => {
    expect(buildMemoNotificationText("memo_rejected", memo)).toContain("ปฏิเสธ");
  });
});

describe("listNotificationsForUser", () => {
  const rawRow = {
    id: 5,
    memo_id: 12,
    notification_type: "memo_pending_approval",
    title: "รออนุมัติ",
    body: "EM-2026-012",
    action_url: "/queue?memo=EM-2026-012",
    is_read: 0,
    read_at: null,
    created_at: "2026-06-15 03:00:00",
  };

  it("scopes the query to the recipient and maps rows to camelCase booleans", async () => {
    const { pool, calls } = makeFakePool([[rawRow], [{ unread: 3 }]]);
    const result = await listNotificationsForUser(pool, 42);

    expect(calls[0].sql).toContain("WHERE recipient_user_id = ?");
    expect(calls[0].params).toEqual([42]);
    expect(calls[1].params).toEqual([42]);
    expect(result.unreadCount).toBe(3);
    expect(result.notifications).toEqual([
      {
        id: 5,
        memoId: 12,
        type: "memo_pending_approval",
        title: "รออนุมัติ",
        body: "EM-2026-012",
        actionUrl: "/queue?memo=EM-2026-012",
        isRead: false,
        readAt: null,
        createdAt: "2026-06-15 03:00:00",
      },
    ]);
  });

  it("clamps the limit to the 1..50 range", async () => {
    const { pool, calls } = makeFakePool([[], [{ unread: 0 }]]);
    await listNotificationsForUser(pool, 1, 9999);
    expect(calls[0].sql).toContain("LIMIT 50");
  });
});

describe("markNotificationRead", () => {
  it("returns true only when an owned unread row was updated", async () => {
    const { pool, calls } = makeFakePool([{ affectedRows: 1 }]);
    const ok = await markNotificationRead(pool, 42, 5);
    expect(ok).toBe(true);
    expect(calls[0].sql).toContain("recipient_user_id = ?");
    expect(calls[0].sql).toContain("is_read = FALSE");
    expect(calls[0].params).toEqual([expect.any(String), 5, 42]);
  });

  it("returns false when nothing matched (wrong owner or already read)", async () => {
    const { pool } = makeFakePool([{ affectedRows: 0 }]);
    expect(await markNotificationRead(pool, 42, 5)).toBe(false);
  });
});

describe("buildMemoNotificationTitle", () => {
  it("uses the Thai label for known types", () => {
    expect(buildMemoNotificationTitle("memo_submitted", "EM-1")).toBe("ส่งเข้าระบบแล้ว: EM-1");
    expect(buildMemoNotificationTitle("memo_status_update", "EM-2")).toBe("อัปเดตสถานะ: EM-2");
    expect(buildMemoNotificationTitle("memo_approved", "EM-3")).toBe("อนุมัติแล้ว: EM-3");
  });
  it("falls back to the raw type for unknown types", () => {
    expect(buildMemoNotificationTitle("something_else", "EM-4")).toBe("something_else: EM-4");
  });
});

describe("parseNotificationLimit", () => {
  it("returns the value for a valid positive number", () => {
    expect(parseNotificationLimit("30")).toBe(30);
  });
  it("falls back to 20 for non-numeric, zero, negative, and missing input", () => {
    expect(parseNotificationLimit("abc")).toBe(20);
    expect(parseNotificationLimit("0")).toBe(20);
    expect(parseNotificationLimit("-5")).toBe(20);
    expect(parseNotificationLimit("")).toBe(20);
    expect(parseNotificationLimit(null)).toBe(20);
  });
});

describe("markAllNotificationsRead", () => {
  it("returns the number of rows marked read for the recipient", async () => {
    const { pool, calls } = makeFakePool([{ affectedRows: 4 }]);
    const n = await markAllNotificationsRead(pool, 42);
    expect(n).toBe(4);
    expect(calls[0].params).toEqual([expect.any(String), 42]);
  });
});
