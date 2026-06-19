import { describe, expect, it } from "vitest";
import { isMemoOwner } from "./memo-ownership";

describe("isMemoOwner — resubmit / submit-revision ownership rule", () => {
  it("(a) FK matches session userId → owner (name irrelevant)", () => {
    expect(isMemoOwner({
      requesterUserId: 42,
      requesterName: "ชื่อเปลี่ยนไปแล้ว",
      sessionUserId: 42,
      sessionFullName: "นัดดา หาญกล้า",
    })).toBe(true);
  });

  it("(b) FK points to another user even though the name matches → NOT owner (collision fix)", () => {
    expect(isMemoOwner({
      requesterUserId: 99,
      requesterName: "นัดดา หาญกล้า",
      sessionUserId: 42,
      sessionFullName: "นัดดา หาญกล้า",
    })).toBe(false);
  });

  it("(c) FK null + name matches → owner (legacy fallback)", () => {
    expect(isMemoOwner({
      requesterUserId: null,
      requesterName: "นัดดา หาญกล้า",
      sessionUserId: 42,
      sessionFullName: "นัดดา หาญกล้า",
    })).toBe(true);
  });

  it("FK undefined + name matches → owner (field absent on legacy rows)", () => {
    expect(isMemoOwner({
      requesterUserId: undefined,
      requesterName: "นัดดา หาญกล้า",
      sessionUserId: 42,
      sessionFullName: "นัดดา หาญกล้า",
    })).toBe(true);
  });

  it("FK null + name does not match → NOT owner", () => {
    expect(isMemoOwner({
      requesterUserId: null,
      requesterName: "คนอื่น",
      sessionUserId: 42,
      sessionFullName: "นัดดา หาญกล้า",
    })).toBe(false);
  });
});
