import { describe, expect, it } from "vitest";
import type { MemoRecord } from "./approval";
import {
  canApproveMemo,
  canMarkReadRecipient,
  canResubmitMemo,
  canReturnOrRejectMemo,
  PROTOTYPE_USERS,
} from "./prototype-users";

const baseMemo: MemoRecord = {
  id: "EM-TEST",
  title: "Permission Test",
  requester: "นัดดา หาญกล้า",
  department: "HR&GA",
  category: "general-purchase",
  amount: 1000,
  status: "pending",
  currentStep: "Manager / Top Section",
  cycleHours: 0,
  createdAt: "05 Jun 2026 10:00",
  updatedAt: "05 Jun 2026 10:00",
};

const user = (id: string) => {
  const found = PROTOTYPE_USERS.find((u) => u.id === id);
  if (!found) throw new Error(`Missing test user: ${id}`);
  return found;
};

describe("prototype user permissions", () => {
  it("allows approvers to approve only their matching workflow step", () => {
    const managerMemo = { ...baseMemo, currentStep: "Manager / Top Section" as const };
    const gmMemo = { ...baseMemo, currentStep: "General Manager" as const };
    const mdMemo = { ...baseMemo, currentStep: "Managing Director" as const };

    expect(canApproveMemo(user("manager"), managerMemo)).toBe(true);
    expect(canApproveMemo(user("manager"), gmMemo)).toBe(false);
    expect(canApproveMemo(user("gm"), gmMemo)).toBe(true);
    expect(canApproveMemo(user("gm"), mdMemo)).toBe(false);
    expect(canApproveMemo(user("md"), mdMemo)).toBe(true);
  });

  it("uses the same role gate for return and reject actions", () => {
    const gmMemo = { ...baseMemo, currentStep: "General Manager" as const };

    expect(canReturnOrRejectMemo(user("gm"), gmMemo)).toBe(true);
    expect(canReturnOrRejectMemo(user("manager"), gmMemo)).toBe(false);
  });

  it("allows admins to perform approval actions at any step", () => {
    const mdMemo = { ...baseMemo, currentStep: "Managing Director" as const };

    expect(canApproveMemo(user("admin"), mdMemo)).toBe(true);
    expect(canReturnOrRejectMemo(user("admin"), mdMemo)).toBe(true);
  });

  it("allows requester or admin to resubmit returned or revision-allowed rejected memos", () => {
    const returnedMemo = { ...baseMemo, status: "returned" as const };
    const rejectedRevisionMemo = {
      ...baseMemo,
      status: "rejected" as const,
      rejectDisposition: "revision-allowed" as const,
    };

    expect(canResubmitMemo(user("requester"), returnedMemo)).toBe(true);
    expect(canResubmitMemo(user("production-requester"), returnedMemo)).toBe(false);
    expect(canResubmitMemo(user("admin"), rejectedRevisionMemo)).toBe(true);
  });

  it("blocks resubmit for rejected memos that are closed", () => {
    const closedRejectedMemo = {
      ...baseMemo,
      status: "rejected" as const,
      rejectDisposition: "close" as const,
    };

    expect(canResubmitMemo(user("requester"), closedRejectedMemo)).toBe(false);
    expect(canResubmitMemo(user("admin"), closedRejectedMemo)).toBe(false);
  });

  it("allows read recipients to mark only matching recipient labels", () => {
    expect(canMarkReadRecipient(user("accfin-reader"), "ACC/FIN")).toBe(true);
    expect(canMarkReadRecipient(user("accfin-reader"), "HR&GA")).toBe(false);
    expect(canMarkReadRecipient(user("admin"), "ACC/FIN")).toBe(true);
  });
});
