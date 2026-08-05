import { describe, it, expect } from "vitest";
import { isDispatchEnabled } from "./dispatch-feature-flag";

describe("isDispatchEnabled", () => {
  it("is disabled when the env var is unset", () => {
    expect(isDispatchEnabled(undefined)).toBe(false);
  });

  it("is disabled when the env var is empty", () => {
    expect(isDispatchEnabled("")).toBe(false);
  });

  it("is enabled only for the exact opt-in value", () => {
    expect(isDispatchEnabled("true")).toBe(true);
  });

  it("accepts the opt-in value regardless of case or padding", () => {
    expect(isDispatchEnabled("TRUE")).toBe(true);
    expect(isDispatchEnabled("  True  ")).toBe(true);
  });

  it("does not treat other truthy-looking values as opt-in", () => {
    expect(isDispatchEnabled("1")).toBe(false);
    expect(isDispatchEnabled("yes")).toBe(false);
    expect(isDispatchEnabled("on")).toBe(false);
    expect(isDispatchEnabled("false")).toBe(false);
  });
});
