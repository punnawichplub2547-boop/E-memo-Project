import { describe, it, expect } from "vitest";
import { stepTowards, clampToBounds } from "./cursor-glow";

describe("stepTowards", () => {
  it("moves a fraction of the remaining distance toward the target", () => {
    // remaining = 100, factor 0.12 → moves 12
    expect(stepTowards(0, 100, 0.12)).toBe(12);
  });

  it("moves toward a target below current (negative direction)", () => {
    expect(stepTowards(100, 0, 0.5)).toBe(50);
  });

  it("snaps exactly to target when the next step lands within epsilon", () => {
    // remaining = 1, factor 0.5 → next = 99.5, within default epsilon 0.5 of 100 → snap
    expect(stepTowards(99, 100, 0.5)).toBe(100);
  });

  it("does not snap when still outside epsilon", () => {
    // remaining = 10, factor 0.5 → next = 95, 5 away from 100 → no snap
    expect(stepTowards(90, 100, 0.5)).toBe(95);
  });

  it("returns target unchanged when already there", () => {
    expect(stepTowards(42, 42, 0.12)).toBe(42);
  });

  it("respects a custom epsilon", () => {
    // next = 95, within epsilon 6 of 100 → snap
    expect(stepTowards(90, 100, 0.5, 6)).toBe(100);
  });
});

describe("clampToBounds", () => {
  it("clamps negative values to 0", () => {
    expect(clampToBounds(-10, 460)).toBe(0);
  });

  it("clamps values above max to max", () => {
    expect(clampToBounds(500, 460)).toBe(460);
  });

  it("passes through in-range values unchanged", () => {
    expect(clampToBounds(120, 460)).toBe(120);
  });
});
