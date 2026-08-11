import { describe, expect, it } from "vitest";
import { memoPersistErrorMessage } from "./memo-persist-error";

describe("memoPersistErrorMessage", () => {
  it("returns nothing for a successful save", () => {
    expect(memoPersistErrorMessage(201, {})).toBeNull();
    expect(memoPersistErrorMessage(200, null)).toBeNull();
  });

  it("stays silent on 409 — the memo is already stored", () => {
    expect(memoPersistErrorMessage(409, { error: "duplicate" })).toBeNull();
  });

  it("surfaces the server's Thai refusal verbatim, names and all", () => {
    // This is the custom-route case: an approver was suspended between picking
    // them and submitting. The requester has to know WHO, or they cannot fix it.
    expect(
      memoPersistErrorMessage(400, {
        error: "ไม่สามารถส่งได้: สมชาย ใจดี ไม่อยู่ในระบบแล้ว กรุณาเลือกผู้อนุมัติใหม่",
      }),
    ).toBe("ไม่สามารถส่งได้: สมชาย ใจดี ไม่อยู่ในระบบแล้ว กรุณาเลือกผู้อนุมัติใหม่");
  });

  it("falls back to a generic Thai message when the body carries no usable error", () => {
    const generic = "บันทึกเมโมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    expect(memoPersistErrorMessage(500, {})).toBe(generic);
    expect(memoPersistErrorMessage(500, null)).toBe(generic);
    expect(memoPersistErrorMessage(400, "not json at all")).toBe(generic);
    expect(memoPersistErrorMessage(400, { error: "   " })).toBe(generic);
    expect(memoPersistErrorMessage(400, { error: 42 })).toBe(generic);
  });
});
