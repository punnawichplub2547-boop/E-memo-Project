import { describe, expect, it } from "vitest";
import { parseMemoDate, isWithinDays, matchesTier } from "./memo-filters";
import { buildCustomRoute } from "./custom-route";

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

describe("matchesTier — custom route", () => {
  const approvers = buildCustomRoute([
    { userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
    { userId: 7, name: "สุภาพร เจริญสุข", approvalLevel: "General Manager", department: "PD" },
  ]).approvers;

  it("matches by the current person's approval level", () => {
    expect(matchesTier("person:2#7", "General Manager", approvers)).toBe(true);
    expect(matchesTier("person:2#7", "Manager / Top Section", approvers)).toBe(false);
  });

  it("still matches everything when no tier is selected", () => {
    expect(matchesTier("person:1#42", "", approvers)).toBe(true);
  });

  it("does not match any tier when the person has no approval level", () => {
    const noLevel = buildCustomRoute([
      { userId: 9, name: "ก ข", approvalLevel: null, department: "QA" },
    ]).approvers;
    expect(matchesTier("person:1#9", "General Manager", noLevel)).toBe(false);
    expect(matchesTier("person:1#9", "", noLevel)).toBe(true);
  });

  it("does not match any tier when the custom snapshot is missing", () => {
    expect(matchesTier("person:1#42", "General Manager")).toBe(false);
    expect(matchesTier("person:1#42", "General Manager", [])).toBe(false);
  });

  it("leaves level routes untouched", () => {
    expect(matchesTier("General Manager", "General Manager")).toBe(true);
    expect(matchesTier("General Manager", "Managing Director")).toBe(false);
  });
});
