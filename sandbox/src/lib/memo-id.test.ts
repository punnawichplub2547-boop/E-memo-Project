import { describe, expect, it } from "vitest";
import { generateMemoId } from "./memo-id";

// UTC instant that is still the PREVIOUS calendar day in Bangkok.
// 2026-05-31T17:30:00Z → Bangkok (UTC+7) = 2026-06-01 00:30:00
const CROSS_MIDNIGHT_UTC = new Date("2026-05-31T17:30:00Z");

// A date with all single-digit month/day/hour/minute/second components
// to verify zero-padding: 2026-01-05T02:03:04Z → Bangkok = 2026-01-05 09:03:04
const LEADING_ZERO_UTC = new Date("2026-01-05T02:03:04Z");

// A known UTC date for full-output testing: 2026-06-01T00:30:04Z → Bangkok = 2026-06-01 07:30:04
const KNOWN_DATE_UTC = new Date("2026-06-01T00:30:04Z");

const ALWAYS_ZERO = () => 0;         // suffix → 000
const ALWAYS_HALF = () => 0.5;       // suffix → 800
const ALWAYS_MAX  = () => 1 - 1e-10; // suffix → FFF

describe("generateMemoId", () => {
  it("produces a string matching the EM-YYYYMMDD-HHMMSS-HHH format", () => {
    const id = generateMemoId(KNOWN_DATE_UTC, ALWAYS_HALF);
    expect(id).toMatch(/^EM-\d{8}-\d{6}-[0-9A-F]{3}$/);
  });

  it("uses Bangkok calendar date, not UTC (cross-midnight test)", () => {
    // UTC 2026-05-31T17:30:00Z is still 2026-06-01 in Bangkok (UTC+7)
    const id = generateMemoId(CROSS_MIDNIGHT_UTC, ALWAYS_ZERO);
    expect(id.startsWith("EM-20260601-")).toBe(true);
  });

  it("zero-pads month, day, hour, minute, second correctly", () => {
    // 2026-01-05T02:03:04Z → Bangkok 2026-01-05 09:03:04
    const id = generateMemoId(LEADING_ZERO_UTC, ALWAYS_ZERO);
    // date part
    expect(id.slice(3, 11)).toBe("20260105");
    // time part: hour=09, minute=03, second=04
    expect(id.slice(12, 18)).toBe("090304");
  });

  it("suffix is 000 when random returns 0", () => {
    const id = generateMemoId(KNOWN_DATE_UTC, ALWAYS_ZERO);
    expect(id.slice(-3)).toBe("000");
  });

  it("suffix is 800 when random returns 0.5", () => {
    // floor(0.5 * 0x1000) = floor(2048) = 0x800 = "800"
    const id = generateMemoId(KNOWN_DATE_UTC, ALWAYS_HALF);
    expect(id.slice(-3)).toBe("800");
  });

  it("suffix is FFF when random returns near 1", () => {
    // floor((1 - ε) * 0x1000) = floor(4095.999…) = 4095 = 0xFFF
    const id = generateMemoId(KNOWN_DATE_UTC, ALWAYS_MAX);
    expect(id.slice(-3)).toBe("FFF");
  });

  it("produces the exact expected string for fully fixed inputs", () => {
    // 2026-06-01T00:30:04Z → Bangkok 2026-06-01 07:30:04; random=0.5 → suffix 800
    const id = generateMemoId(KNOWN_DATE_UTC, ALWAYS_HALF);
    expect(id).toBe("EM-20260601-073004-800");
  });

  it("two calls with different injected randoms produce different IDs (deterministic)", () => {
    const a = generateMemoId(KNOWN_DATE_UTC, ALWAYS_ZERO);
    const b = generateMemoId(KNOWN_DATE_UTC, ALWAYS_MAX);
    expect(a).not.toBe(b);
  });
});
