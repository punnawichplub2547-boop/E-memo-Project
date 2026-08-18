import { describe, it, expect } from "vitest";
import { safeSpreadsheetText } from "./excel-safe-text";

describe("safeSpreadsheetText", () => {
  it.each(["=", "+", "-", "@"])(
    "prefixes an apostrophe when the text starts with %s",
    (char) => {
      expect(safeSpreadsheetText(`${char}HYPERLINK("http://evil")`)).toBe(
        `'${char}HYPERLINK("http://evil")`
      );
    }
  );

  it("prefixes tab and carriage return too", () => {
    expect(safeSpreadsheetText("\tcmd")).toBe("'\tcmd");
    expect(safeSpreadsheetText("\rcmd")).toBe("'\rcmd");
  });

  it("leaves ordinary Thai text untouched", () => {
    expect(safeSpreadsheetText("ขออนุมัติซื้อวัตถุดิบ")).toBe("ขออนุมัติซื้อวัตถุดิบ");
  });

  it("leaves a negative number untouched because it is not a string", () => {
    expect(safeSpreadsheetText(-1500)).toBe("-1500");
  });

  it("returns an empty string for null and undefined", () => {
    expect(safeSpreadsheetText(null)).toBe("");
    expect(safeSpreadsheetText(undefined)).toBe("");
  });
});
