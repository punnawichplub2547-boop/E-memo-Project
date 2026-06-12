import { describe, expect, it } from "vitest";
import { buildMemoNotificationText } from "./notifications";

const memo = { memoNo: "EM-2026-042", title: "ซื้อวัตถุดิบ", requesterName: "สมชาย", currentStep: "Managing Director" };

describe("buildMemoNotificationText", () => {
  it("pending approval includes all fields", () => {
    const t = buildMemoNotificationText("memo_pending_approval", memo);
    expect(t).toContain("EM-2026-042");
    expect(t).toContain("ซื้อวัตถุดิบ");
    expect(t).toContain("สมชาย");
    expect(t).toContain("Managing Director");
  });
  it("approved message contains อนุมัติ", () => {
    expect(buildMemoNotificationText("memo_approved", memo)).toContain("อนุมัติ");
  });
  it("returned message contains ส่งคืน", () => {
    expect(buildMemoNotificationText("memo_returned", memo)).toContain("ส่งคืน");
  });
  it("rejected message contains ปฏิเสธ", () => {
    expect(buildMemoNotificationText("memo_rejected", memo)).toContain("ปฏิเสธ");
  });
});
