import { describe, it, expect } from "vitest";
import { spanColumns, FORM_COL_WIDTHS } from "./span-columns";

const width = ([from, to]: [number, number]) =>
  FORM_COL_WIDTHS.slice(from - 1, to).reduce((sum, w) => sum + w, 0);

describe("spanColumns", () => {
  it("gives one column the whole form", () => {
    expect(spanColumns(1)).toEqual([[1, 12]]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("returns %i groups that cover all 12 columns", (n) => {
    const spans = spanColumns(n);
    expect(spans).toHaveLength(n);
    expect(spans[0][0]).toBe(1);
    expect(spans[spans.length - 1][1]).toBe(12);
    // ต่อกันสนิท ไม่ทับ ไม่มีช่องว่าง
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i][0]).toBe(spans[i - 1][1] + 1);
    }
  });

  it.each([2, 3, 4, 5, 6, 7, 8])(
    "keeps every group of %i within 60%% of the average width",
    (n) => {
      const spans = spanColumns(n);
      const average = 102 / n;
      for (const span of spans) {
        expect(width(span)).toBeGreaterThan(average * 0.4);
        expect(width(span)).toBeLessThan(average * 1.6);
      }
    }
  );

  it("never returns an empty group", () => {
    for (let n = 1; n <= 8; n++) {
      for (const [from, to] of spanColumns(n)) expect(to).toBeGreaterThanOrEqual(from);
    }
  });

  it("clamps a request for more columns than the form can hold", () => {
    expect(spanColumns(20)).toHaveLength(8);
  });
});
