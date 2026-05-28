import { describe, expect, it } from "vitest";
import {
  clampNonNegativeInputElement,
  clampPositiveIntegerInputElement,
  coerceNonNegativeNumber,
  coercePositiveInteger,
  shouldBlockNonNegativeNumberKey,
  shouldBlockPositiveIntegerKey,
} from "./number-input";

describe("number input coercion", () => {
  it("coerces invalid or negative values to zero for money fields", () => {
    expect(coerceNonNegativeNumber("-10000")).toBe(0);
    expect(coerceNonNegativeNumber(-1)).toBe(0);
    expect(coerceNonNegativeNumber("")).toBe(0);
    expect(coerceNonNegativeNumber("abc")).toBe(0);
  });

  it("keeps positive numeric values for money fields", () => {
    expect(coerceNonNegativeNumber("10000")).toBe(10000);
    expect(coerceNonNegativeNumber(12.5)).toBe(12.5);
  });

  it("coerces invalid, zero, or negative quantities to one", () => {
    expect(coercePositiveInteger("-3")).toBe(1);
    expect(coercePositiveInteger(0)).toBe(1);
    expect(coercePositiveInteger("")).toBe(1);
    expect(coercePositiveInteger("abc")).toBe(1);
  });

  it("keeps positive quantities as integers", () => {
    expect(coercePositiveInteger("4")).toBe(4);
    expect(coercePositiveInteger(2.8)).toBe(2);
  });

  it("clamps negative input element values for money fields", () => {
    const input = { value: "-7" } as HTMLInputElement;

    clampNonNegativeInputElement(input);

    expect(input.value).toBe("0");
  });

  it("clamps negative input element values for quantity fields", () => {
    const input = { value: "-7" } as HTMLInputElement;

    clampPositiveIntegerInputElement(input);

    expect(input.value).toBe("1");
  });

  it("blocks keys that can create negative or exponent money values", () => {
    expect(shouldBlockNonNegativeNumberKey("-")).toBe(true);
    expect(shouldBlockNonNegativeNumberKey("e")).toBe(true);
    expect(shouldBlockNonNegativeNumberKey("5")).toBe(false);
    expect(shouldBlockNonNegativeNumberKey(".")).toBe(false);
  });

  it("blocks decimal keys for integer quantities", () => {
    expect(shouldBlockPositiveIntegerKey(".")).toBe(true);
    expect(shouldBlockPositiveIntegerKey("-")).toBe(true);
    expect(shouldBlockPositiveIntegerKey("5")).toBe(false);
  });
});
