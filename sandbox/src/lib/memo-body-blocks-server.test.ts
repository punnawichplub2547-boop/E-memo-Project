import { describe, it, expect } from "vitest";
import { resolveBodyBlocksFromRequest } from "./memo-body-blocks-server";

const freeform = (blocks: unknown, extra = {}) =>
  resolveBodyBlocksFromRequest({ formMode: "freeform", blocks, hasCustomRoute: true, ...extra });

describe("resolveBodyBlocksFromRequest", () => {
  it("accepts a standard memo with no blocks", () => {
    const result = resolveBodyBlocksFromRequest({
      formMode: "standard", blocks: null, hasCustomRoute: false,
    });
    expect(result).toMatchObject({ status: "ok", formMode: "standard", blocks: null });
  });

  it("rejects a standard memo that smuggles blocks in", () => {
    const result = resolveBodyBlocksFromRequest({
      formMode: "standard",
      blocks: [{ id: "a", type: "paragraph", text: "x" }],
      hasCustomRoute: false,
    });
    expect(result.status).toBe("invalid");
  });

  it("rejects an unknown form mode", () => {
    expect(resolveBodyBlocksFromRequest({
      formMode: "whatever", blocks: null, hasCustomRoute: false,
    }).status).toBe("invalid");
  });

  it("rejects a free-form memo without a custom route", () => {
    const result = resolveBodyBlocksFromRequest({
      formMode: "freeform", blocks: [], hasCustomRoute: false,
    });
    expect(result.status).toBe("invalid");
  });

  it("accepts a free-form memo with no blocks yet", () => {
    expect(freeform([])).toMatchObject({ status: "ok", blocks: [] });
  });

  it("rejects a table with more than eight columns", () => {
    const headers = Array.from({ length: 9 }, (_, i) => `c${i}`);
    expect(freeform([{ id: "t", type: "table", headers, rows: [headers] }]).status).toBe("invalid");
  });

  it("rejects a table row that is not as wide as its header", () => {
    expect(freeform([{ id: "t", type: "table", headers: ["a", "b"], rows: [["only one"]] }]).status)
      .toBe("invalid");
  });

  it("rejects the same system block twice", () => {
    expect(freeform([
      { id: "s1", type: "system", ref: "priceComparison" },
      { id: "s2", type: "system", ref: "priceComparison" },
    ]).status).toBe("invalid");
  });

  it("asks the caller to clear price data when no price block is present", () => {
    expect(freeform([{ id: "p", type: "paragraph", text: "x" }])).toMatchObject({
      status: "ok", clearPriceComparisons: true, clearRequestItems: true,
    });
  });

  it("keeps price data when the price block is present", () => {
    expect(freeform([{ id: "s", type: "system", ref: "priceComparison" }])).toMatchObject({
      status: "ok", clearPriceComparisons: false, clearRequestItems: true,
    });
  });

  it("refuses to switch the form mode on a revision", () => {
    const result = resolveBodyBlocksFromRequest({
      formMode: "freeform", blocks: [], hasCustomRoute: true, existingFormMode: "standard",
    });
    expect(result.status).toBe("invalid");
  });

  it("rejects an unknown block type", () => {
    expect(freeform([{ id: "x", type: "video", src: "http://x" }]).status).toBe("invalid");
  });
});
