import { describe, expect, it } from "vitest";
import { groupMemosByDate } from "./group-memos";

type Stub = { id: string; updatedAt: string };
const s = (id: string, updatedAt: string): Stub => ({ id, updatedAt });

describe("groupMemosByDate", () => {
  it("returns empty array for empty input", () => {
    expect(groupMemosByDate([])).toEqual([]);
  });

  it("single item produces one group with that item", () => {
    const result = groupMemosByDate([s("a", "17 May 2026 09:00")]);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("17 May 2026");
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].id).toBe("a");
  });

  it("consecutive items with the same date land in one group", () => {
    const items = [
      s("a", "17 May 2026 09:00"),
      s("b", "17 May 2026 14:30"),
      s("c", "17 May 2026 17:00"),
    ];
    const result = groupMemosByDate(items);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("17 May 2026");
    expect(result[0].items.map(i => i.id)).toEqual(["a", "b", "c"]);
  });

  it("items with distinct dates produce one group per date in first-seen order", () => {
    const items = [
      s("a", "17 May 2026 09:00"),
      s("b", "18 May 2026 09:00"),
      s("c", "19 May 2026 09:00"),
    ];
    const result = groupMemosByDate(items);
    expect(result).toHaveLength(3);
    expect(result.map(g => g.date)).toEqual(["17 May 2026", "18 May 2026", "19 May 2026"]);
    expect(result.map(g => g.items[0].id)).toEqual(["a", "b", "c"]);
  });

  it("non-consecutive same-date items land in the correct bucket (regression: always-last-group bug)", () => {
    // A: 18 May, B: 17 May, C: 18 May — the original bug placed C in the 17 May group
    // because it pushed to groups[groups.length - 1] instead of looking up by key.
    const items = [
      s("a", "18 May 2026 09:00"),
      s("b", "17 May 2026 09:00"),
      s("c", "18 May 2026 11:00"),
    ];
    const result = groupMemosByDate(items);
    expect(result).toHaveLength(2);
    const may18 = result.find(g => g.date === "18 May 2026")!;
    const may17 = result.find(g => g.date === "17 May 2026")!;
    expect(may18.items.map(i => i.id)).toEqual(["a", "c"]);
    expect(may17.items.map(i => i.id)).toEqual(["b"]);
  });

  it("group order follows first-seen date, not sort order", () => {
    // 22 May seen before 20 May — groups should preserve that order
    const items = [
      s("a", "22 May 2026 10:00"),
      s("b", "20 May 2026 10:00"),
      s("c", "22 May 2026 15:00"),
    ];
    const result = groupMemosByDate(items);
    expect(result[0].date).toBe("22 May 2026");
    expect(result[1].date).toBe("20 May 2026");
  });
});
