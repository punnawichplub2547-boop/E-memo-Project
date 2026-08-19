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
    expect(result).toMatchObject({
      status: "invalid",
      reason: "ฟอร์มมาตรฐานต้องไม่มีบล็อกเนื้อหา",
    });
  });

  it("rejects an unknown form mode", () => {
    const result = resolveBodyBlocksFromRequest({
      formMode: "whatever", blocks: null, hasCustomRoute: false,
    });
    expect(result).toMatchObject({
      status: "invalid",
      reason: "form_mode ต้องเป็น standard หรือ freeform",
    });
  });

  it("rejects a free-form memo without a custom route", () => {
    const result = resolveBodyBlocksFromRequest({
      formMode: "freeform", blocks: [], hasCustomRoute: false,
    });
    expect(result).toMatchObject({
      status: "invalid",
      reason: "ฟอร์มอิสระต้องเลือกผู้อนุมัติเอง",
    });
  });

  it("accepts a free-form memo with no blocks yet", () => {
    expect(freeform([])).toMatchObject({ status: "ok", blocks: [] });
  });

  it("rejects a table with more than eight columns", () => {
    const headers = Array.from({ length: 9 }, (_, i) => `c${i}`);
    const result = freeform([{ id: "t", type: "table", headers, rows: [headers] }]);
    expect(result).toMatchObject({
      status: "invalid",
      reason: "ตารางมีคอลัมน์เกิน 8 คอลัมน์",
    });
  });

  it("rejects a table row that is not as wide as its header", () => {
    const result = freeform([{ id: "t", type: "table", headers: ["a", "b"], rows: [["only one"]] }]);
    expect(result).toMatchObject({
      status: "invalid",
      reason: "แถวในตารางต้องมีจำนวนคอลัมน์เท่ากับหัวตารางและเป็นข้อความทั้งหมด",
    });
  });

  it("rejects the same system block twice", () => {
    const result = freeform([
      { id: "s1", type: "system", ref: "priceComparison" },
      { id: "s2", type: "system", ref: "priceComparison" },
    ]);
    expect(result).toMatchObject({
      status: "invalid",
      reason: "บล็อกระบบซ้ำชนิดกัน",
    });
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
    expect(result).toMatchObject({
      status: "invalid",
      reason: "เปลี่ยนรูปแบบฟอร์มระหว่างแก้ไขไม่ได้",
    });
  });

  it("rejects an unknown block type", () => {
    const result = freeform([{ id: "x", type: "video", src: "http://x" }]);
    expect(result).toMatchObject({
      status: "invalid",
      reason: "ไม่รู้จักชนิดบล็อกนี้",
    });
  });

  describe("strips unknown client-supplied keys instead of trusting a cast", () => {
    it("rebuilds a paragraph block without its extra key", () => {
      const result = freeform([
        { id: "p", type: "paragraph", text: "hi", secretPayload: { leak: true } },
      ]);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("unreachable");
      expect(result.blocks).toEqual([{ id: "p", type: "paragraph", text: "hi" }]);
    });

    it("rebuilds a table block without its extra key", () => {
      const result = freeform([
        {
          id: "t",
          type: "table",
          headers: ["a", "b"],
          rows: [["1", "2"]],
          secretPayload: { leak: true },
        },
      ]);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("unreachable");
      expect(result.blocks).toEqual([
        { id: "t", type: "table", headers: ["a", "b"], rows: [["1", "2"]] },
      ]);
    });

    it("rebuilds a keyValue block, and each pair inside it, without extra keys", () => {
      const result = freeform([
        {
          id: "k",
          type: "keyValue",
          pairs: [{ key: "a", value: "1", secretPayload: { leak: true } }],
          secretPayload: { leak: true },
        },
      ]);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("unreachable");
      expect(result.blocks).toEqual([
        { id: "k", type: "keyValue", pairs: [{ key: "a", value: "1" }] },
      ]);
    });

    it("rebuilds a system block without its extra key", () => {
      const result = freeform([
        { id: "s", type: "system", ref: "priceComparison", secretPayload: { leak: true } },
      ]);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("unreachable");
      expect(result.blocks).toEqual([{ id: "s", type: "system", ref: "priceComparison" }]);
    });
  });
});
