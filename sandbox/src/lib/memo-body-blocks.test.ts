import { describe, it, expect } from "vitest";
import {
  moveBlock, removeBlock, hasSystemBlock, createBlock,
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
