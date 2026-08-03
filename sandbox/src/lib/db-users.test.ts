import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { departmentHasActiveSupervisor } from "./db-users";

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
