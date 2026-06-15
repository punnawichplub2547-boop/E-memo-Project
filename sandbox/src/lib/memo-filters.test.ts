import { describe, expect, it } from "vitest";
import { parseMemoDate, isWithinDays, matchesTier } from "./memo-filters";

describe("parseMemoDate", () => {
  it("parses 'DD Mon YYYY HH:MM'", () => {
    const d = parseMemoDate("09 Jun 2026 09:15")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(9);
  });
  it("parses without a time part", () => {
    expect(parseMemoDate("05 Jan 2026")?.getMonth()).toBe(0);
  });
  it("returns null for unparseable input", () => {
    expect(parseMemoDate("not a date")).toBeNull();
    expect(parseMemoDate("")).toBeNull();
  });
});

describe("isWithinDays", () => {
  const now = new Date(2026, 5, 15, 12, 0); // 15 Jun 2026

  it("days <= 0 means All time (always true)", () => {
    expect(isWithinDays("01 Jan 2020 00:00", 0, now)).toBe(true);
  });
  it("true when inside the window", () => {
    expect(isWithinDays("10 Jun 2026 09:00", 30, now)).toBe(true);
  });
  it("false when outside the window", () => {
    expect(isWithinDays("01 Jan 2026 09:00", 30, now)).toBe(false);
  });
  it("false for unparseable date", () => {
    expect(isWithinDays("bad", 30, now)).toBe(false);
  });
});

describe("matchesTier", () => {
  it("empty tier matches everything", () => {
    expect(matchesTier("General Manager", "")).toBe(true);
  });
  it("matches exact currentStep", () => {
    expect(matchesTier("Managing Director", "Managing Director")).toBe(true);
  });
  it("rejects non-match", () => {
    expect(matchesTier("Manager / Top Section", "Managing Director")).toBe(false);
  });
});
