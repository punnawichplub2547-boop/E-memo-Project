import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import {
  createIssueReport,
  deleteIssueReport,
  listIssueReports,
  mapIssueReportRow,
  parseIssueStatusFilter,
  setIssueReportStatus,
} from "./issue-reports";

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

const rawRow = {
  id: 7,
  reporter_user_id: 3,
  reporter_name: "สมหญิง ใจดี",
  reporter_department: "IT",
  reporter_email: "somying@car-1996.com",
  description: "หน้า /queue error 500",
  status: "open" as const,
  created_at: "2026-06-24 02:00:00",
  resolved_at: null,
  resolved_by_user_id: null,
};

describe("mapIssueReportRow", () => {
  it("maps snake_case row to typed report", () => {
    const r = mapIssueReportRow(rawRow);
    expect(r.id).toBe(7);
    expect(r.reporterUserId).toBe(3);
    expect(r.reporterName).toBe("สมหญิง ใจดี");
    expect(r.reporterDepartment).toBe("IT");
    expect(r.status).toBe("open");
    expect(r.resolvedAt).toBeNull();
  });

  it("keeps null reporter_user_id as null", () => {
    expect(mapIssueReportRow({ ...rawRow, reporter_user_id: null }).reporterUserId).toBeNull();
  });
});

describe("parseIssueStatusFilter", () => {
  it("accepts open/resolved", () => {
    expect(parseIssueStatusFilter("open")).toBe("open");
    expect(parseIssueStatusFilter("resolved")).toBe("resolved");
  });
  it("rejects anything else as undefined", () => {
    expect(parseIssueStatusFilter("all")).toBeUndefined();
    expect(parseIssueStatusFilter(null)).toBeUndefined();
    expect(parseIssueStatusFilter("")).toBeUndefined();
  });
});

describe("createIssueReport", () => {
  it("inserts with status open and returns insertId", async () => {
    const { pool, calls } = makeFakePool([{ insertId: 42 }]);
    const id = await createIssueReport(pool, {
      reporterUserId: 3,
      reporterName: "สมหญิง ใจดี",
      reporterDepartment: "IT",
      reporterEmail: "somying@car-1996.com",
      description: "ปัญหา",
    });
    expect(id).toBe(42);
    expect(calls[0].sql).toContain("INSERT INTO issue_reports");
    expect(calls[0].params).toContain("ปัญหา");
    expect(calls[0].params).toContain(3);
  });
});

describe("listIssueReports", () => {
  it("applies status filter and returns reports + total", async () => {
    const { pool, calls } = makeFakePool([[rawRow], [{ total: 1 }]]);
    const { reports, total } = await listIssueReports(pool, { status: "open", limit: 10, offset: 0 });
    expect(reports).toHaveLength(1);
    expect(total).toBe(1);
    expect(calls[0].sql).toContain("WHERE status = ?");
    expect(calls[0].params).toEqual(["open", 10, 0]);
    expect(calls[1].params).toEqual(["open"]);
  });

  it("omits WHERE when no status filter and clamps limit", async () => {
    const { pool, calls } = makeFakePool([[], [{ total: 0 }]]);
    await listIssueReports(pool, { limit: 9999 });
    expect(calls[0].sql).not.toContain("WHERE status");
    expect(calls[0].params).toEqual([100, 0]); // limit clamped to 100, default offset 0
  });
});

describe("setIssueReportStatus", () => {
  it("resolving stamps resolved_at + resolver", async () => {
    const { pool, calls } = makeFakePool([{ affectedRows: 1 }]);
    const ok = await setIssueReportStatus(pool, 7, "resolved", 99);
    expect(ok).toBe(true);
    const [status, resolvedAt, resolvedBy, id, guard] = calls[0].params as unknown[];
    expect(status).toBe("resolved");
    expect(resolvedAt).not.toBeNull();
    expect(resolvedBy).toBe(99);
    expect(id).toBe(7);
    expect(guard).toBe("resolved"); // WHERE status <> ? prevents no-op writes
  });

  it("reopening clears resolved_at + resolver", async () => {
    const { pool, calls } = makeFakePool([{ affectedRows: 1 }]);
    await setIssueReportStatus(pool, 7, "open", 99);
    const [status, resolvedAt, resolvedBy] = calls[0].params as unknown[];
    expect(status).toBe("open");
    expect(resolvedAt).toBeNull();
    expect(resolvedBy).toBeNull();
  });

  it("returns false when no row changed", async () => {
    const { pool } = makeFakePool([{ affectedRows: 0 }]);
    expect(await setIssueReportStatus(pool, 7, "resolved", 99)).toBe(false);
  });
});

describe("deleteIssueReport", () => {
  it("deletes by id and returns true when a row changed", async () => {
    const query = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const pool = { query } as never;
    const ok = await deleteIssueReport(pool, 7);
    expect(ok).toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/DELETE FROM issue_reports/i);
    expect(params).toEqual([7]);
  });

  it("returns false when no row matched", async () => {
    const query = vi.fn().mockResolvedValue([{ affectedRows: 0 }]);
    const ok = await deleteIssueReport({ query } as never, 999);
    expect(ok).toBe(false);
  });
});
