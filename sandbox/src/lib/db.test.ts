import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("mysql2/promise", () => ({
  default: { createPool: vi.fn(() => ({ __pool: true })) },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getDbPool DATABASE_URL handling", () => {
  it("throws a clear error in production when DATABASE_URL is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    const { getDbPool } = await import("./db");
    expect(() => getDbPool()).toThrow(/DATABASE_URL/);
  });

  it("does not throw in production when DATABASE_URL is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "mysql://u:p@db:3306/x";
    const { getDbPool } = await import("./db");
    expect(() => getDbPool()).not.toThrow();
  });

  it("falls back to the localhost dev URL outside production when DATABASE_URL is missing", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    const mysql = (await import("mysql2/promise")).default;
    const { getDbPool } = await import("./db");
    expect(() => getDbPool()).not.toThrow();
    expect(vi.mocked(mysql.createPool)).toHaveBeenCalledWith(
      expect.objectContaining({ uri: expect.stringContaining("127.0.0.1:3307") }),
    );
  });
});
