import { describe, expect, it } from "vitest";
import { buildCustomRoute } from "../custom-route";
import { buildCustomSignatureSlots } from "./memo-signature-slots";

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    userId: i + 1,
    name: `ผู้อนุมัติ ${i + 1}`,
    approvalLevel: i === n - 1 ? "Managing Director" : "Manager / Top Section",
    department: "IT",
  }));

describe("buildCustomSignatureSlots", () => {
  it("shows all approvers when there are 5 or fewer", () => {
    const { approvers } = buildCustomRoute(people(3));
    const { slots, hiddenCount } = buildCustomSignatureSlots(approvers, []);
    expect(slots).toHaveLength(3);
    expect(hiddenCount).toBe(0);
    expect(slots.map((s) => s.label)).toEqual(["ผู้อนุมัติ 1", "ผู้อนุมัติ 2", "ผู้อนุมัติ 3"]);
  });

  it("fills exactly 5 slots when there are exactly 5", () => {
    const { approvers } = buildCustomRoute(people(5));
    const { slots, hiddenCount } = buildCustomSignatureSlots(approvers, []);
    expect(slots).toHaveLength(5);
    expect(hiddenCount).toBe(0);
    expect(slots[4].label).toBe("ผู้อนุมัติ 5");
  });

  it("Q24: with 8 approvers shows the first 4 plus the final approver and reports 3 hidden", () => {
    const { approvers } = buildCustomRoute(people(8));
    const { slots, hiddenCount } = buildCustomSignatureSlots(approvers, []);
    expect(slots).toHaveLength(5);
    expect(slots.map((s) => s.label)).toEqual([
      "ผู้อนุมัติ 1",
      "ผู้อนุมัติ 2",
      "ผู้อนุมัติ 3",
      "ผู้อนุมัติ 4",
      "ผู้อนุมัติ 8",
    ]);
    expect(hiddenCount).toBe(3);
  });

  it("labels the final slot as อนุมัติ and the others as ตรวจ/เห็นชอบ", () => {
    const { approvers } = buildCustomRoute(people(8));
    const { slots } = buildCustomSignatureSlots(approvers, []);
    expect(slots[0].subLabel).toContain("ตรวจ/เห็นชอบ");
    expect(slots[4].subLabel).toContain("อนุมัติ");
    expect(slots[4].subLabel).toContain("Managing Director");
  });

  it("keeps the final slot's role right even when a duplicate person appears earlier", () => {
    // Same user picked twice: the tokens differ by position, so the role must be
    // decided by position, never by identity.
    const { approvers } = buildCustomRoute([
      { userId: 5, name: "ก ข", approvalLevel: "Manager / Top Section", department: "IT" },
      { userId: 9, name: "ค ง", approvalLevel: "General Manager", department: "PD" },
      { userId: 5, name: "ก ข", approvalLevel: "Manager / Top Section", department: "IT" },
    ]);
    const { slots } = buildCustomSignatureSlots(approvers, []);
    expect(slots).toHaveLength(3);
    expect(slots[0].subLabel).toContain("ตรวจ/เห็นชอบ");
    expect(slots[2].subLabel).toContain("อนุมัติ");
    expect(slots[2].stepKey).toBe("person:3#5");
  });

  it("attaches the matching signature by step key", () => {
    const { approvers } = buildCustomRoute(people(3));
    const { slots } = buildCustomSignatureSlots(approvers, [
      { stepLabel: "person:2#2", actorName: "ผู้อนุมัติ 2", actedAt: "10 Aug 2026 09:00" },
    ]);
    expect(slots[1].signature?.actorName).toBe("ผู้อนุมัติ 2");
    expect(slots[0].signature).toBeUndefined();
  });

  it("returns no slots for an empty approver list", () => {
    expect(buildCustomSignatureSlots([], [])).toEqual({ slots: [], hiddenCount: 0 });
  });
});
