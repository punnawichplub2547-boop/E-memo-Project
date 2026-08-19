// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBodyBlocks } from "./useBodyBlocks";

describe("useBodyBlocks", () => {
  it("starts as a standard memo with no blocks", () => {
    const { result } = renderHook(() => useBodyBlocks());
    expect(result.current.formMode).toBe("standard");
    expect(result.current.blocks).toEqual([]);
  });

  it("adds blocks in the order they were added", () => {
    const { result } = renderHook(() => useBodyBlocks());
    act(() => result.current.addBlock("paragraph"));
    act(() => result.current.addBlock("table"));
    expect(result.current.blocks.map((b) => b.type)).toEqual(["paragraph", "table"]);
  });

  it("moves a block down by one", () => {
    const { result } = renderHook(() => useBodyBlocks());
    act(() => result.current.addBlock("paragraph"));
    act(() => result.current.addBlock("table"));
    const firstId = result.current.blocks[0].id;
    act(() => result.current.moveBlockBy(firstId, 1));
    expect(result.current.blocks[1].id).toBe(firstId);
  });

  it("ignores a move past the end of the list", () => {
    const { result } = renderHook(() => useBodyBlocks());
    act(() => result.current.addBlock("paragraph"));
    const id = result.current.blocks[0].id;
    act(() => result.current.moveBlockBy(id, 1));
    expect(result.current.blocks[0].id).toBe(id);
  });

  it("reports a system block as used so the menu can disable it", () => {
    const { result } = renderHook(() => useBodyBlocks());
    act(() => result.current.addBlock("system", "priceComparison"));
    expect(result.current.isSystemBlockUsed("priceComparison")).toBe(true);
    expect(result.current.isSystemBlockUsed("requestItems")).toBe(false);
  });

  it("edits a paragraph in place", () => {
    const { result } = renderHook(() => useBodyBlocks());
    act(() => result.current.addBlock("paragraph"));
    const id = result.current.blocks[0].id;
    act(() => result.current.updateBlock(id, { text: "แก้แล้ว" } as never));
    expect(result.current.blocks[0]).toMatchObject({ text: "แก้แล้ว" });
  });

  it("drops every block when the mode goes back to standard", () => {
    const { result } = renderHook(() => useBodyBlocks());
    act(() => result.current.setFormMode("freeform"));
    act(() => result.current.addBlock("paragraph"));
    act(() => result.current.setFormMode("standard"));
    expect(result.current.blocks).toEqual([]);
  });
});
