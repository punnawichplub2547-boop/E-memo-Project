import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { departmentHasActiveSupervisor, searchActiveUsers } from "./db-users";

// searchActiveUsers reaches for the shared pool itself, so the module has to be
// mocked (departmentHasActiveSupervisor above takes its pool as an argument).
const poolCalls: Array<{ sql: string; params: unknown[] }> = [];
let poolRows: unknown[] = [];

vi.mock("./db", () => ({
  getDbPool: () =>
    ({
      query: async (sql: string, params: unknown[] = []) => {
        poolCalls.push({ sql, params });
        return [poolRows, undefined];
      },
    }) as unknown as Pool,
}));

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

describe("departmentHasActiveSupervisor", () => {
  it("returns true when at least one active Supervisor exists in the department", async () => {
    const { pool } = trackingPool([{ 1: 1 }]);
    expect(await departmentHasActiveSupervisor(pool, "HR&GA")).toBe(true);
  });

  it("returns false when no active Supervisor exists in the department", async () => {
    const { pool } = trackingPool([]);
    expect(await departmentHasActiveSupervisor(pool, "HR&GA")).toBe(false);
  });

  it("queries by Supervisor approval_level, department and active status", async () => {
    const { pool, calls } = trackingPool([]);
    await departmentHasActiveSupervisor(pool, "IT");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("approval_level = 'Supervisor'");
    expect(calls[0].sql).toContain("department = ?");
    expect(calls[0].sql).toContain("status = 'active'");
    expect(calls[0].params).toEqual(["IT"]);
  });
});

describe("searchActiveUsers scope", () => {
  beforeEach(() => {
    poolCalls.length = 0;
    poolRows = [];
  });

  const captureSearchSql = async (q: string, scope?: "cc" | "approver") => {
    await searchActiveUsers(q, scope);
    expect(poolCalls).toHaveLength(1);
    return poolCalls[0];
  };

  const runSearchWith = async (rows: unknown[], scope?: "cc" | "approver") => {
    poolRows = rows;
    return searchActiveUsers("สม", scope);
  };

  it("keeps excluding Managing Director by default (CC picker behaviour)", async () => {
    const { sql } = await captureSearchSql("สม");
    expect(sql).toContain("approval_level != 'Managing Director'");
    expect(sql).toContain("status = 'active'");
  });

  it("keeps excluding Managing Director when the scope is explicitly cc", async () => {
    const { sql } = await captureSearchSql("สม", "cc");
    expect(sql).toContain("approval_level != 'Managing Director'");
  });

  it("includes every active user when scope is approver", async () => {
    const { sql, params } = await captureSearchSql("สม", "approver");
    expect(sql).not.toContain("Managing Director");
    expect(sql).toContain("status = 'active'");
    expect(params).toEqual(["สม%", "สม%"]);
  });

  it("returns the user id and approval level for the approver scope", async () => {
    const rows = await runSearchWith(
      [
        {
          id: 42,
          email: "a@car-1996.com",
          first_name: "สมชาย",
          last_name: "ใจดี",
          department: "IT",
          approval_level: "Manager / Top Section",
        },
      ],
      "approver",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      userId: 42,
      email: "a@car-1996.com",
      firstName: "สมชาย",
      lastName: "ใจดี",
      department: "IT",
      approvalLevel: "Manager / Top Section",
    });
  });

  it("keeps the CC-scope fields the picker already relies on", async () => {
    const rows = await runSearchWith([
      {
        id: 8,
        email: "b@car-1996.com",
        first_name: "สมหญิง",
        last_name: "ดีงาม",
        department: "PD",
        approval_level: null,
      },
    ]);
    expect(rows[0]).toMatchObject({
      email: "b@car-1996.com",
      firstName: "สมหญิง",
      lastName: "ดีงาม",
      department: "PD",
    });
    expect(rows[0].approvalLevel).toBeNull();
  });

  it("still returns [] without querying for queries shorter than 2 characters", async () => {
    expect(await searchActiveUsers("ก", "approver")).toEqual([]);
    expect(await searchActiveUsers(" ", )).toEqual([]);
    expect(poolCalls).toHaveLength(0);
  });
});
