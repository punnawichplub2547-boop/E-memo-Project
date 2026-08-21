import { describe, it, expect } from "vitest";
import {
  moveBlock, removeBlock, hasSystemBlock, createBlock,
  setTableHeader, setTableCell, addTableColumn, addTableRow, removeTableRow, removeTableColumn,
  setKeyValuePair, MAX_TABLE_COLUMNS, shouldConfirmFormModeSwitch,
  type MemoBodyBlock,
} from "./memo-body-blocks";

const p = (id: string): MemoBodyBlock => ({ id, type: "paragraph", text: id });

describe("moveBlock", () => {
  it("moves a block down and shifts the rest up", () => {
    const out = moveBlock([p("a"), p("b"), p("c")], 0, 2);
    expect(out.map((b) => b.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a block up", () => {
    const out = moveBlock([p("a"), p("b"), p("c")], 2, 0);
    expect(out.map((b) => b.id)).toEqual(["c", "a", "b"]);
  });

  it("returns the same order when the index is out of range", () => {
    const input = [p("a"), p("b")];
    expect(moveBlock(input, 0, 5).map((b) => b.id)).toEqual(["a", "b"]);
    expect(moveBlock(input, -1, 1).map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [p("a"), p("b")];
    moveBlock(input, 0, 1);
    expect(input.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("hasSystemBlock", () => {
  it("finds a system block by its ref", () => {
    const blocks: MemoBodyBlock[] = [p("a"), { id: "s", type: "system", ref: "priceComparison" }];
    expect(hasSystemBlock(blocks, "priceComparison")).toBe(true);
    expect(hasSystemBlock(blocks, "requestItems")).toBe(false);
  });
});

describe("removeBlock", () => {
  it("removes only the block with that id", () => {
    const out = removeBlock([p("a"), p("b")], "a");
    expect(out.map((b) => b.id)).toEqual(["b"]);
  });
});

describe("createBlock", () => {
  it("gives every new block a unique id", () => {
    expect(createBlock("paragraph").id).not.toEqual(createBlock("paragraph").id);
  });

  it("starts a table with one column and one empty row", () => {
    const block = createBlock("table");
    if (block.type !== "table") throw new Error("expected a table block");
    expect(block.headers).toHaveLength(1);
    expect(block.rows).toEqual([[""]]);
  });

  it("carries the ref through for a system block", () => {
    const block = createBlock("system", "requestItems");
    if (block.type !== "system") throw new Error("expected a system block");
    expect(block.ref).toBe("requestItems");
  });
});

describe("setTableHeader", () => {
  it("renames only the targeted column", () => {
    const headers = ["a", "b"];
    const rows = [["1", "2"]];
    const out = setTableHeader(headers, rows, 1, "b2");
    expect(out.headers).toEqual(["a", "b2"]);
    expect(out.rows).toBe(rows);
  });

  it("does not mutate the original headers array", () => {
    const headers = ["a", "b"];
    const rows = [["1", "2"]];
    setTableHeader(headers, rows, 0, "changed");
    expect(headers).toEqual(["a", "b"]);
  });
});

describe("setTableCell", () => {
  it("edits only the targeted cell", () => {
    const headers = ["a", "b"];
    const rows = [
      ["1", "2"],
      ["3", "4"],
    ];
    const out = setTableCell(headers, rows, 1, 0, "99");
    expect(out.rows).toEqual([
      ["1", "2"],
      ["99", "4"],
    ]);
  });

  it("does not mutate the original rows array or its row arrays", () => {
    const headers = ["a", "b"];
    const rows = [
      ["1", "2"],
      ["3", "4"],
    ];
    const snapshot = rows.map((row) => [...row]);
    setTableCell(headers, rows, 0, 1, "changed");
    expect(rows).toEqual(snapshot);
  });
});

describe("addTableColumn", () => {
  it("appends an empty header and syncs an empty cell into every existing row", () => {
    const headers = ["a", "b"];
    const rows = [
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ];
    const out = addTableColumn(headers, rows);
    expect(out.headers).toEqual(["a", "b", ""]);
    expect(out.rows).toEqual([
      ["1", "2", ""],
      ["3", "4", ""],
      ["5", "6", ""],
    ]);
  });

  it("is a no-op at the MAX_TABLE_COLUMNS cap, returning the same references unchanged", () => {
    const headers = Array.from({ length: MAX_TABLE_COLUMNS }, (_, i) => `h${i}`);
    const rows = [headers.map(() => "")];
    const out = addTableColumn(headers, rows);
    expect(out.headers).toBe(headers);
    expect(out.rows).toBe(rows);
    expect(out.headers).toHaveLength(MAX_TABLE_COLUMNS);
  });
});

describe("addTableRow", () => {
  it("appends one empty row sized to the current column count", () => {
    const headers = ["a", "b", "c"];
    const rows = [["1", "2", "3"]];
    const out = addTableRow(headers, rows);
    expect(out.rows).toEqual([["1", "2", "3"], ["", "", ""]]);
  });
});

describe("removeTableRow", () => {
  it("removes exactly the targeted row", () => {
    const headers = ["a"];
    const rows = [["1"], ["2"], ["3"]];
    const out = removeTableRow(headers, rows, 1);
    expect(out.rows).toEqual([["1"], ["3"]]);
  });
});

describe("removeTableColumn", () => {
  it("drops the header and the same index from every row", () => {
    const out = removeTableColumn(
      ["ชื่อ", "จำนวน", "ราคา"],
      [["ก", "1", "10"], ["ข", "2", "20"]],
      1,
    );
    expect(out.headers).toEqual(["ชื่อ", "ราคา"]);
    expect(out.rows).toEqual([["ก", "10"], ["ข", "20"]]);
  });

  it("leaves the other columns' values untouched when removing the first column", () => {
    const out = removeTableColumn(["a", "b", "c"], [["1", "2", "3"]], 0);
    expect(out.headers).toEqual(["b", "c"]);
    expect(out.rows).toEqual([["2", "3"]]);
  });

  it("is a no-op for an out-of-range index, returning the same references", () => {
    const headers = ["a", "b"];
    const rows = [["1", "2"]];
    for (const index of [-1, 2, 99]) {
      const out = removeTableColumn(headers, rows, index);
      expect(out.headers).toBe(headers);
      expect(out.rows).toBe(rows);
    }
  });

  // A table with zero columns has no cell left to type into and would render as an
  // empty block on the ISO form — "delete the block" is the action for that, not
  // "delete the last column".
  it("refuses to delete the last remaining column", () => {
    const headers = ["a"];
    const rows = [["1"], ["2"]];
    const out = removeTableColumn(headers, rows, 0);
    expect(out.headers).toBe(headers);
    expect(out.rows).toBe(rows);
  });

  it("does not mutate the original headers array or its row arrays", () => {
    const headers = ["a", "b"];
    const rows = [["1", "2"]];
    removeTableColumn(headers, rows, 0);
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  // Rows can be shorter/longer than headers (legacy data, a future validator change):
  // splicing a ragged row must not invent cells or throw.
  it("tolerates a row that is shorter than the header list", () => {
    const out = removeTableColumn(["a", "b", "c"], [["1", "2", "3"], ["1"]], 2);
    expect(out.headers).toEqual(["a", "b"]);
    expect(out.rows).toEqual([["1", "2"], ["1"]]);
  });
});

describe("shouldConfirmFormModeSwitch", () => {
  it("requires confirmation when switching to standard while blocks exist", () => {
    expect(shouldConfirmFormModeSwitch("standard", 1)).toBe(true);
    expect(shouldConfirmFormModeSwitch("standard", 3)).toBe(true);
  });

  it("does not require confirmation switching to standard with no blocks", () => {
    expect(shouldConfirmFormModeSwitch("standard", 0)).toBe(false);
  });

  it("never requires confirmation switching to freeform, regardless of block count", () => {
    expect(shouldConfirmFormModeSwitch("freeform", 0)).toBe(false);
    expect(shouldConfirmFormModeSwitch("freeform", 5)).toBe(false);
  });
});

describe("setKeyValuePair", () => {
  it("patches only the targeted pair, leaving the rest untouched", () => {
    const pairs = [
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ];
    const out = setKeyValuePair(pairs, 1, { value: "99" });
    expect(out).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "99" },
    ]);
    expect(out[0]).toBe(pairs[0]);
  });

  it("does not mutate the original pairs array", () => {
    const pairs = [{ key: "a", value: "1" }];
    setKeyValuePair(pairs, 0, { key: "changed" });
    expect(pairs).toEqual([{ key: "a", value: "1" }]);
  });
});
