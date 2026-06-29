import { describe, it, expect, vi, beforeEach } from "vitest";
import { isResetTokenUsable, hasRecentResetToken, type ResetTokenRow } from "./password-reset";

vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));
import { getDbPool } from "@/lib/db";

const NOW = new Date("2026-06-29T12:00:00Z");

function row(over: Partial<ResetTokenRow>): ResetTokenRow {
  return { expires_at: "2026-06-29 13:00:00", used_at: null, ...over };
}

describe("isResetTokenUsable", () => {
  it("accepts an unused token that has not expired", () => {
    expect(isResetTokenUsable(row({}), NOW)).toBe(true);
  });

  it("rejects a token that is already used", () => {
    expect(isResetTokenUsable(row({ used_at: "2026-06-29 11:30:00" }), NOW)).toBe(false);
  });

  it("rejects a token whose expiry is in the past", () => {
    expect(isResetTokenUsable(row({ expires_at: "2026-06-29 11:00:00" }), NOW)).toBe(false);
  });

  it("rejects a token expiring exactly now (boundary)", () => {
    expect(isResetTokenUsable(row({ expires_at: "2026-06-29 12:00:00" }), NOW)).toBe(false);
  });

  it("rejects a missing row", () => {
    expect(isResetTokenUsable(null, NOW)).toBe(false);
    expect(isResetTokenUsable(undefined, NOW)).toBe(false);
  });
});

describe("hasRecentResetToken", () => {
  let query: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    query = vi.fn();
    vi.mocked(getDbPool).mockReturnValue({ query } as never);
  });

  it("returns true when a token for the user exists inside the cooldown window", async () => {
    query.mockResolvedValue([[{ "1": 1 }]]);
    const result = await hasRecentResetToken(42);
    expect(result).toBe(true);
    const params = query.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(42);
  });

  it("returns false when there is no recent token for the user", async () => {
    query.mockResolvedValue([[]]);
    expect(await hasRecentResetToken(42)).toBe(false);
  });

  it("passes the requested cooldown window to the query", async () => {
    query.mockResolvedValue([[]]);
    await hasRecentResetToken(42, 5);
    const params = query.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe(5);
  });
});
