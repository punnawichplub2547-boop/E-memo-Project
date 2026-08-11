import { describe, expect, it } from "vitest";
import type { MemoRecord } from "./approval";
import {
  canApproveMemo,
  canMarkReadRecipient,
  canRejectMemo,
  canResubmitMemo,
  canReturnOrRejectMemo,
  canReviewMdMemo,
  prototypeUserAuthId,
  PROTOTYPE_USERS,
  type PrototypeUser,
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

  it("allows only Managing Director (or admin) to act on a pending MD review, and only while it's pending", () => {
    const memoUnderReview: MemoRecord = {
      ...baseMemo,
      currentStep: "Managing Director",
      requiresMdReview: true,
      mdReviewStatus: "pending",
    };
    const memoNormalMdStep: MemoRecord = {
      ...baseMemo,
      currentStep: "Managing Director",
    };

    expect(canReviewMdMemo(user("md"), memoUnderReview)).toBe(true);
    expect(canReviewMdMemo(user("admin"), memoUnderReview)).toBe(true);
    expect(canReviewMdMemo(user("gm"), memoUnderReview)).toBe(false);
    expect(canReviewMdMemo(user("md"), memoNormalMdStep)).toBe(false);
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

  it("provides an active Supervisor prototype user with the Supervisor approval level", () => {
    const supervisor = user("supervisor");
    expect(supervisor.approvalLevel).toBe("Supervisor");
    expect(supervisor.roles).toContain("supervisor");
  });

  it("lets a Supervisor return but NOT reject a memo at their step", () => {
    const supervisorMemo = { ...baseMemo, currentStep: "Supervisor" as const };

    // Supervisor is a check-only step: they can pass/return, but rejecting is a
    // Manager-and-above power (Q3). canReturnOrRejectMemo still allows return/skip.
    expect(canReturnOrRejectMemo(user("supervisor"), supervisorMemo)).toBe(true);
    expect(canRejectMemo(user("supervisor"), supervisorMemo)).toBe(false);
    expect(canApproveMemo(user("supervisor"), supervisorMemo)).toBe(true);
  });

  it("lets Manager and admin reject, matching canRejectMemo to their step", () => {
    const managerMemo = { ...baseMemo, currentStep: "Manager / Top Section" as const };
    const mdMemo = { ...baseMemo, currentStep: "Managing Director" as const };

    expect(canRejectMemo(user("manager"), managerMemo)).toBe(true);
    expect(canRejectMemo(user("manager"), mdMemo)).toBe(false);
    expect(canRejectMemo(user("admin"), mdMemo)).toBe(true);
  });

  it("allows read recipients to mark only matching recipient labels", () => {
    expect(canMarkReadRecipient(user("accfin-reader"), "ACC/FIN")).toBe(true);
    expect(canMarkReadRecipient(user("accfin-reader"), "HR&GA")).toBe(false);
    expect(canMarkReadRecipient(user("admin"), "ACC/FIN")).toBe(true);
  });
});

describe("custom route permissions", () => {
  const customMemo = {
    ...baseMemo,
    status: "pending",
    currentStep: "person:2#42",
    selectedRoute: ["person:1#7", "person:2#42", "person:3#9"],
  } as MemoRecord;

  const authUser = (id: number, over: Partial<PrototypeUser> = {}): PrototypeUser => ({
    id: `auth-${id}`,
    name: `ผู้ใช้ ${id}`,
    department: "IT",
    roleLabel: "Requester",
    roles: ["requester"],
    approvalLevel: undefined,
    ...over,
  });

  it("extracts the numeric user id from an auth-backed prototype user", () => {
    expect(prototypeUserAuthId(authUser(42))).toBe(42);
    expect(prototypeUserAuthId(user("manager"))).toBeNull();
    expect(prototypeUserAuthId(authUser(7, { id: "auth-x7" }))).toBeNull();
  });

  it("lets the named person approve their custom step", () => {
    expect(canApproveMemo(authUser(42), customMemo)).toBe(true);
  });

  it("blocks everyone else, including a Managing Director", () => {
    expect(canApproveMemo(authUser(9, { approvalLevel: "Managing Director" }), customMemo)).toBe(false);
    expect(canApproveMemo(user("md"), customMemo)).toBe(false);
  });

  it("keeps admin able to act on a custom step", () => {
    expect(canApproveMemo(authUser(3, { roles: ["admin"] }), customMemo)).toBe(true);
    expect(canRejectMemo(authUser(3, { roles: ["admin"] }), customMemo)).toBe(true);
  });

  it("hides Reject for a non-final custom step but keeps Approve and Return", () => {
    expect(canApproveMemo(authUser(42), customMemo)).toBe(true);
    expect(canReturnOrRejectMemo(authUser(42), customMemo)).toBe(true);
    expect(canRejectMemo(authUser(42), customMemo)).toBe(false);
  });

  it("allows Reject for the final custom step", () => {
    const finalMemo = { ...customMemo, currentStep: "person:3#9" } as MemoRecord;
    expect(canRejectMemo(authUser(9), finalMemo)).toBe(true);
  });

  it("allows Reject for a single-person custom route", () => {
    const soloMemo = {
      ...baseMemo,
      status: "pending",
      currentStep: "person:1#42",
      selectedRoute: ["person:1#42"],
    } as MemoRecord;
    expect(canRejectMemo(authUser(42), soloMemo)).toBe(true);
  });

  it("does not approve a custom step when the memo is not pending", () => {
    const approved = { ...customMemo, status: "approved" } as MemoRecord;
    expect(canApproveMemo(authUser(42), approved)).toBe(false);
  });

  it("leaves level-route permissions untouched", () => {
    const levelMemo = {
      ...baseMemo,
      status: "pending",
      currentStep: "General Manager",
      selectedRoute: ["Manager / Top Section", "General Manager"],
    } as MemoRecord;
    expect(canApproveMemo(user("gm"), levelMemo)).toBe(true);
    expect(canRejectMemo(user("gm"), levelMemo)).toBe(true);
    expect(canApproveMemo(authUser(9), levelMemo)).toBe(false);

    const supervisorMemo = {
      ...baseMemo,
      status: "pending",
      currentStep: "Supervisor",
      selectedRoute: ["Supervisor", "Manager / Top Section"],
    } as MemoRecord;
    expect(canApproveMemo(user("supervisor"), supervisorMemo)).toBe(true);
    expect(canRejectMemo(user("supervisor"), supervisorMemo)).toBe(false);
  });
});
