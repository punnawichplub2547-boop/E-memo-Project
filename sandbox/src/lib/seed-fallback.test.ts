import { describe, expect, it } from "vitest";
import { allowSeedFallbackOnDbError } from "./seed-fallback";

describe("allowSeedFallbackOnDbError", () => {
  it("allows the seed fallback in development", () => {
    expect(allowSeedFallbackOnDbError("development")).toBe(true);
  });

  it("allows the seed fallback in test", () => {
    expect(allowSeedFallbackOnDbError("test")).toBe(true);
  });

  it("allows the seed fallback when NODE_ENV is undefined", () => {
    expect(allowSeedFallbackOnDbError(undefined)).toBe(true);
  });

  it("blocks the seed fallback in production", () => {
    expect(allowSeedFallbackOnDbError("production")).toBe(false);
  });
});
