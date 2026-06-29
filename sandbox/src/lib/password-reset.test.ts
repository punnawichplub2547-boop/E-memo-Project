import { describe, it, expect } from "vitest";
import { isResetTokenUsable, type ResetTokenRow } from "./password-reset";

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
