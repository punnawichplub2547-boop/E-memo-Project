import { describe, it, expect } from "vitest";
import { sortSearchResults, SEARCH_PAGE_SIZE, type SearchSortKey } from "./search-sort";

type Row = { id: string; updatedAt: string; amount: number };

const rows: Row[] = [
  { id: "a", updatedAt: "17 Jul 2026 15:45", amount: 500 },
  { id: "b", updatedAt: "02 Aug 2026 09:00", amount: 70000 },
  { id: "c", updatedAt: "09 Jun 2026 09:15", amount: 12000 },
];

const ids = (list: Row[]) => list.map(r => r.id);

describe("sortSearchResults", () => {
  it("leaves the given order untouched for relevance", () => {
    expect(ids(sortSearchResults(rows, "relevance"))).toEqual(["a", "b", "c"]);
  });

  it("sorts newest first by the displayed date, not by string order", () => {
    // "02 Aug" sorts before "17 Jul" as a plain string, so a lexicographic
    // sort would put b last instead of first.
    expect(ids(sortSearchResults(rows, "newest"))).toEqual(["b", "a", "c"]);
  });

  it("sorts the largest amount first", () => {
    expect(ids(sortSearchResults(rows, "amount"))).toEqual(["b", "c", "a"]);
  });

  it("never mutates the array it was given", () => {
    const original = [...rows];
    sortSearchResults(rows, "newest");
    sortSearchResults(rows, "amount");
    expect(rows).toEqual(original);
  });

  it("pushes rows with an unreadable date to the end instead of dropping them", () => {
    const withBadDate = [...rows, { id: "d", updatedAt: "", amount: 1 }];
    const sorted = sortSearchResults(withBadDate, "newest");
    expect(sorted).toHaveLength(4);
    expect(sorted[sorted.length - 1].id).toBe("d");
  });

  it("keeps the original order among rows sharing the same date", () => {
    const sameDate: Row[] = [
      { id: "x", updatedAt: "01 Jun 2026 09:00", amount: 1 },
      { id: "y", updatedAt: "01 Jun 2026 09:00", amount: 2 },
    ];
    expect(ids(sortSearchResults(sameDate, "newest"))).toEqual(["x", "y"]);
  });

  it("returns an empty list unchanged for every sort key", () => {
    const keys: SearchSortKey[] = ["relevance", "newest", "amount"];
    for (const key of keys) {
      expect(sortSearchResults([], key)).toEqual([]);
    }
  });
});

describe("SEARCH_PAGE_SIZE", () => {
  it("shows a workable first page", () => {
    expect(SEARCH_PAGE_SIZE).toBeGreaterThan(0);
  });
});
