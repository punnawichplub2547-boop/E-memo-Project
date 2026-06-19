import { describe, expect, it, vi } from "vitest";
import {
  resolveApprovalStepRecipients,
  resolveMemoCcRecipients,
  resolveReadRecipientLabels,
  resolveRequesterRecipient,
} from "./notification-recipients";
import type { Pool } from "mysql2/promise";

function pool1(rows: unknown[]): Pool {
  return { query: vi.fn().mockResolvedValue([rows, undefined]) } as unknown as Pool;
}

function ccPool(labelRows: unknown, userRows: unknown) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let i = 0;
  const results = [labelRows, userRows];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return [results[i++], undefined];
    },
  } as unknown as Pool;
  return { pool, calls };
}

describe("resolveApprovalStepRecipients", () => {
  it("returns user ids for active users at approval level", async () => {
    const result = await resolveApprovalStepRecipients("General Manager", pool1([{ id: 7 }, { id: 8 }]));
    expect(result).toEqual([7, 8]);
  });
  it("returns empty array when no match", async () => {
    expect(await resolveApprovalStepRecipients("MD", pool1([]))).toEqual([]);
  });
});

describe("resolveRequesterRecipient", () => {
  function trackingPool(rows: unknown[]) {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return [rows, undefined];
      },
    } as unknown as Pool;
    return { pool, calls };
  }

  it("(b) FK null → falls back to a name match", async () => {
    expect(await resolveRequesterRecipient("สมชาย รักษ์ดี", null, pool1([{ id: 5 }]))).toBe(5);
  });

  it("(b) FK null + name not found → null", async () => {
    expect(await resolveRequesterRecipient("ไม่มี", null, pool1([]))).toBeNull();
  });

  it("(a) FK set + user active → returns the FK id and queries by id (never by name)", async () => {
    const { pool, calls } = trackingPool([{ id: 5 }]);
    expect(await resolveRequesterRecipient("any name", 5, pool)).toBe(5);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("WHERE id = ?");
    expect(calls[0].sql).not.toContain("first_name");
    expect(calls[0].params).toEqual([5]);
  });

  it("(c) FK set but user suspended/inactive → returns null and does NOT fall back to name", async () => {
    const { pool, calls } = trackingPool([]); // active-status query finds nothing
    expect(await resolveRequesterRecipient("สมชาย รักษ์ดี", 5, pool)).toBeNull();
    expect(calls).toHaveLength(1); // no second name-fallback query
    expect(calls[0].sql).toContain("status = 'active'");
  });
});

describe("resolveReadRecipientLabels", () => {
  it("deduplicates results", async () => {
    const result = await resolveReadRecipientLabels(["HR&GA"], pool1([{ id: 4 }, { id: 4 }]));
    expect(result.filter(id => id === 4).length).toBe(1);
  });
});

describe("resolveMemoCcRecipients", () => {
  it("resolves email and exact-name labels to user ids, filtered by revision", async () => {
    const { pool, calls } = ccPool(
      [{ recipient_name: "a@car-1996.com" }, { recipient_name: "สมชาย ขายจริง" }],
      [
        { id: 10, email: "a@car-1996.com", full_name: "Aaa Bbb" },
        { id: 11, email: "x@car-1996.com", full_name: "สมชาย ขายจริง" },
      ],
    );
    const ids = await resolveMemoCcRecipients(7, 2, pool);
    expect(ids.sort()).toEqual([10, 11]);
    expect(calls[0].sql).toContain("revision_no = ?");
    expect(calls[0].params).toEqual([7, 2]);
  });

  it("returns empty when the memo has no read recipients", async () => {
    const { pool } = ccPool([], []);
    expect(await resolveMemoCcRecipients(7, 1, pool)).toEqual([]);
  });

  it("skips department-only / unmatched labels (no fan-out)", async () => {
    const { pool } = ccPool([{ recipient_name: "PD" }], []);
    expect(await resolveMemoCcRecipients(7, 1, pool)).toEqual([]);
  });
});
