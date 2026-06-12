import { describe, expect, it } from "vitest";
import { createTokenExpiry, generateRawToken, hashToken, isTokenExpired } from "./tokens";

describe("generateRawToken", () => {
  it("returns a 64-char hex string", () => {
    expect(generateRawToken()).toMatch(/^[0-9a-f]{64}$/);
  });
  it("generates unique values", () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe("hashToken", () => {
  it("returns deterministic 64-char hex hash", () => {
    const h = hashToken("test-abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("test-abc")).toBe(h);
  });
  it("different inputs produce different hashes", () => {
    expect(hashToken("aaa")).not.toBe(hashToken("bbb"));
  });
});

describe("createTokenExpiry", () => {
  it("returns a future Date", () => {
    expect(createTokenExpiry(10).getTime()).toBeGreaterThan(Date.now());
  });
  it("adds approximately the specified minutes", () => {
    const before = Date.now();
    const diff = createTokenExpiry(30).getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(30 * 60 * 1000 - 500);
    expect(diff).toBeLessThanOrEqual(30 * 60 * 1000 + 500);
  });
});

describe("isTokenExpired", () => {
  it("true for past Date", () => expect(isTokenExpired(new Date(Date.now() - 1000))).toBe(true));
  it("false for future Date", () => expect(isTokenExpired(new Date(Date.now() + 60_000))).toBe(false));
  it("parses MySQL UTC datetime strings", () => {
    expect(isTokenExpired("2020-01-01 00:00:00")).toBe(true);
    expect(isTokenExpired("2099-01-01 00:00:00")).toBe(false);
  });
});
