import { MAX_TABLE_COLUMNS } from "../memo-body-blocks";

/** ความกว้างคอลัมน์ของฟอร์ม F-DC-006 — ต้องตรงกับ colWidths ใน memo-excel.ts */
export const FORM_COL_WIDTHS = [5, 10, 10, 8, 8, 8, 7.5, 7.5, 9.5, 9.5, 9.5, 9.5];
const TOTAL_COLS = FORM_COL_WIDTHS.length;
const TOTAL_WIDTH = FORM_COL_WIDTHS.reduce((sum, w) => sum + w, 0); // 102

// PREFIX[i] = sum of the first i column widths, PREFIX[0] = 0.
const PREFIX = FORM_COL_WIDTHS.reduce<number[]>(
  (acc, w) => [...acc, acc[acc.length - 1] + w],
  [0]
);

/**
 * แบ่ง 12 คอลัมน์ของฟอร์มออกเป็น n กลุ่มที่ "กว้างใกล้เคียงกัน"
 * แบ่งตามความกว้างจริง ไม่ใช่จำนวนคอลัมน์ เพราะคอลัมน์แรกกว้างแค่ 5
 * ขณะที่คอลัมน์อื่นกว้าง 7.5-10 — แบ่งตามจำนวนจะได้ตารางเบี้ยว
 *
 * Algorithm: for `groups - 1` internal boundaries, place each cut at the
 * column whose cumulative width lands closest to that boundary's ideal
 * (k * TOTAL_WIDTH / groups) target, while reserving at least one column
 * for every group still to come. This is a "nearest cumulative boundary"
 * partition, not a left-to-right greedy accumulate-until-target walk —
 * the greedy walk can strand the final group with a single narrow column
 * (e.g. n=4 leaves group 4 at width 9.5, below the 40%-of-average floor).
 */
export function spanColumns(n: number): Array<[number, number]> {
  const groups = Math.max(1, Math.min(n, MAX_TABLE_COLUMNS));
  if (groups === 1) return [[1, TOTAL_COLS]];

  const cuts: number[] = [];
  let previousCut = 0;
  for (let k = 1; k < groups; k++) {
    const target = (TOTAL_WIDTH * k) / groups;
    const lower = previousCut + 1;
    const upper = TOTAL_COLS - (groups - k); // leave >=1 column per remaining group

    let best = lower;
    let bestDiff = Math.abs(PREFIX[lower] - target);
    for (let i = lower + 1; i <= upper; i++) {
      const diff = Math.abs(PREFIX[i] - target);
      if (diff < bestDiff) {
        best = i;
        bestDiff = diff;
      }
    }
    cuts.push(best);
    previousCut = best;
  }

  const spans: Array<[number, number]> = [];
  let start = 1;
  for (const cut of cuts) {
    spans.push([start, cut]);
    start = cut + 1;
  }
  spans.push([start, TOTAL_COLS]);
  return spans;
}
