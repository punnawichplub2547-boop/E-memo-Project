import { describe, expect, it } from "vitest";
import type { MemoRecord } from "./approval";
import type { SessionUser } from "./auth-jwt";
import { isMemoVisibleTo } from "./memo-visibility";

// ── Minimal fixtures ─────────────────────────────────────────────────────────

function makeMemo(overrides: Partial<MemoRecord> = {}): MemoRecord {
  return {
    id: "EM-VIS-TEST",
    title: "Visibility Test Memo",
    requester: "นัดดา หาญกล้า",
    department: "HR&GA",
    category: "general-purchase",
    amount: 5000,
    status: "pending",
    currentStep: "Manager / Top Section",
    selectedRoute: ["Manager / Top Section"],
    cycleHours: 0,
    createdAt: "10 Jun 2026 09:00",
    updatedAt: "10 Jun 2026 09:00",
    // notifyMD is optional; default to false via override below
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: 1,
    employeeCardId: "EMP001",
    email: "nadda@car-1996.com",
    firstName: "นัดดา",
    lastName: "หาญกล้า",
    department: "HR&GA",
    roles: ["requester"],
    approvalLevel: null,
    ...overrides,
  };
}

// ── Admin ────────────────────────────────────────────────────────────────────

describe("admin role", () => {
  it("sees any memo regardless of requester", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "someone else entirely" }),
      makeSession({ roles: ["admin"] }),
    )).toBe(true);
  });

  it("sees memo with no route or readRecipients", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: undefined, recommendedRoute: undefined, readRecipients: undefined }),
      makeSession({ roles: ["admin"] }),
    )).toBe(true);
  });

  it("sees soft-deleted memo", () => {
    expect(isMemoVisibleTo(
      makeMemo({ deletedAt: "10 Jun 2026 08:00" }),
      makeSession({ roles: ["admin"] }),
    )).toBe(true);
  });
});

// ── Requester ────────────────────────────────────────────────────────────────

describe("requester role — name matching (temporary limitation)", () => {
  it("sees own memo when requester matches firstName+lastName exactly", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "นัดดา หาญกล้า" }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(true);
  });

  it("does not see another user's memo", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "สุภาพร เจริญสุข" }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(false);
  });

  it("name matching is exact — partial first name only does not match", () => {
    // Documents the temporary limitation: only full firstName+lastName works
    expect(isMemoVisibleTo(
      makeMemo({ requester: "นัดดา หาญกล้า" }),
      makeSession({ firstName: "นัดดา", lastName: "", roles: ["requester"] }),
    )).toBe(false);
  });

  it("sees own memo when status is returned (edit/resubmit access)", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "นัดดา หาญกล้า", status: "returned" }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(true);
  });

  it("sees own memo when status is rejected+revision-allowed", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "นัดดา หาญกล้า", status: "rejected", rejectDisposition: "revision-allowed" }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(true);
  });

  it("sees own approved memo", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "นัดดา หาญกล้า", status: "approved" }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(true);
  });
});

// ── Approver roles ───────────────────────────────────────────────────────────

describe("approver roles", () => {
  it("manager sees memo with their level in selectedRoute", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Manager / Top Section"] }),
      makeSession({ roles: ["manager"], approvalLevel: "Manager / Top Section" }),
    )).toBe(true);
  });

  it("manager sees memo where currentStep equals their level (route may be empty)", () => {
    expect(isMemoVisibleTo(
      makeMemo({ currentStep: "Manager / Top Section", selectedRoute: [] }),
      makeSession({ roles: ["manager"], approvalLevel: "Manager / Top Section" }),
    )).toBe(true);
  });

  it("manager does not see memo not in their route and not at their step", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        selectedRoute: ["General Manager", "Managing Director"],
        currentStep: "General Manager",
      }),
      makeSession({ roles: ["manager"], approvalLevel: "Manager / Top Section" }),
    )).toBe(false);
  });

  it("manager does not see memo in route but from a different department", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Manager / Top Section"], department: "IT" }),
      makeSession({ roles: ["manager"], approvalLevel: "Manager / Top Section", department: "HR&GA" }),
    )).toBe(false);
  });

  it("manager sees memo in route from their own department", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Manager / Top Section"], department: "IT" }),
      makeSession({ roles: ["manager"], approvalLevel: "Manager / Top Section", department: "IT" }),
    )).toBe(true);
  });

  it("GM sees memo in route from a different department (no dept restriction)", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["General Manager"], department: "PC" }),
      makeSession({ roles: ["general-manager"], approvalLevel: "General Manager", department: "GM" }),
    )).toBe(true);
  });

  it("MD sees memo in route from a different department (no dept restriction)", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Managing Director"], department: "MK" }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director", department: "MD" }),
    )).toBe(true);
  });

  it("GM sees memo with General Manager in selectedRoute", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Manager / Top Section", "General Manager"] }),
      makeSession({ roles: ["general-manager"], approvalLevel: "General Manager" }),
    )).toBe(true);
  });

  it("GM sees memo where currentStep is General Manager", () => {
    expect(isMemoVisibleTo(
      makeMemo({ currentStep: "General Manager", selectedRoute: [] }),
      makeSession({ roles: ["general-manager"], approvalLevel: "General Manager" }),
    )).toBe(true);
  });

  it("GM sees memo in recommendedRoute even when not in selectedRoute (override case)", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        selectedRoute: ["Manager / Top Section"],
        recommendedRoute: ["Manager / Top Section", "General Manager"],
      }),
      makeSession({ roles: ["general-manager"], approvalLevel: "General Manager" }),
    )).toBe(true);
  });

  it("MD sees memo with Managing Director in selectedRoute", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Manager / Top Section", "Managing Director"] }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director" }),
    )).toBe(true);
  });

  it("MD sees memo where currentStep is Managing Director", () => {
    expect(isMemoVisibleTo(
      makeMemo({ currentStep: "Managing Director", selectedRoute: [] }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director" }),
    )).toBe(true);
  });

  it("user with no approvalLevel set gets no approver visibility", () => {
    // Use a different requester so the requester-name rule does not interfere
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["General Manager"], requester: "สุภาพร เจริญสุข" }),
      makeSession({ roles: ["requester"], approvalLevel: null }),
    )).toBe(false);
  });
});

// ── Managing Director — notifyMD visibility ──────────────────────────────────

describe("managing-director notifyMD visibility (awareness only)", () => {
  it("MD sees notifyMD=true memo even when not in route", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        notifyMD: true,
        selectedRoute: ["Manager / Top Section"],
        currentStep: "Manager / Top Section",
      }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director" }),
    )).toBe(true);
  });

  it("MD does not see notifyMD=false memo when not in route", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        notifyMD: false,
        selectedRoute: ["Manager / Top Section"],
        currentStep: "Manager / Top Section",
      }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director" }),
    )).toBe(false);
  });

  it("MD does not see memo with undefined notifyMD when not in route", () => {
    // notifyMD is optional; undefined must not be treated as true
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["Manager / Top Section"], currentStep: "Manager / Top Section" }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director" }),
    )).toBe(false);
  });

  it("notifyMD visibility does not grant approval permission — canApproveMemo is separate", () => {
    // isMemoVisibleTo returns true here (MD can see it for awareness).
    // Approval permission is governed by canApproveMemo() which checks
    // currentStep === approvalLevel. That function is unmodified; this test
    // only verifies visibility is true and does not call canApproveMemo.
    expect(isMemoVisibleTo(
      makeMemo({
        notifyMD: true,
        selectedRoute: ["Manager / Top Section"],
        currentStep: "Manager / Top Section",
      }),
      makeSession({ roles: ["managing-director"], approvalLevel: "Managing Director" }),
    )).toBe(true);
  });
});

// ── Read recipient ────────────────────────────────────────────────────────────

describe("read-recipient role", () => {
  it("sees memo with their full name in readRecipients", () => {
    expect(isMemoVisibleTo(
      makeMemo({ readRecipients: ["กมลวรรณ สินธุ์ทอง", "ACC/FIN"] }),
      makeSession({
        firstName: "กมลวรรณ", lastName: "สินธุ์ทอง",
        department: "ACC/FIN",
        roles: ["read-recipient"], approvalLevel: null,
      }),
    )).toBe(true);
  });

  it("sees memo with their department in readRecipients", () => {
    expect(isMemoVisibleTo(
      makeMemo({ readRecipients: ["ACC/FIN"] }),
      makeSession({
        firstName: "กมลวรรณ", lastName: "สินธุ์ทอง",
        department: "ACC/FIN",
        roles: ["read-recipient"], approvalLevel: null,
      }),
    )).toBe(true);
  });

  it("sees memo with their name in readActions recipients", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        readActions: [{ recipient: "กมลวรรณ สินธุ์ทอง", status: "pending" }],
      }),
      makeSession({
        firstName: "กมลวรรณ", lastName: "สินธุ์ทอง",
        department: "ACC/FIN",
        roles: ["read-recipient"], approvalLevel: null,
      }),
    )).toBe(true);
  });

  it("does not see memo where no recipient label matches", () => {
    expect(isMemoVisibleTo(
      makeMemo({ readRecipients: ["IT", "DC"] }),
      makeSession({
        firstName: "กมลวรรณ", lastName: "สินธุ์ทอง",
        department: "ACC/FIN",
        roles: ["read-recipient"], approvalLevel: null,
      }),
    )).toBe(false);
  });

  it("does not see memo with empty readRecipients and no readActions", () => {
    expect(isMemoVisibleTo(
      makeMemo({ readRecipients: [], readActions: undefined }),
      makeSession({
        firstName: "กมลวรรณ", lastName: "สินธุ์ทอง",
        department: "ACC/FIN",
        roles: ["read-recipient"], approvalLevel: null,
      }),
    )).toBe(false);
  });
});

// ── CC visibility is role-independent ────────────────────────────────────────

describe("CC visibility is role-independent (no read-recipient role needed)", () => {
  it("requester-only user sees memo they are CC'd on by name", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        requester: "สุภาพร เจริญสุข",
        readRecipients: ["นัดดา หาญกล้า"],
      }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(true);
  });

  it("requester-only user sees memo they are CC'd on by department", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        requester: "สุภาพร เจริญสุข",
        readRecipients: ["HR&GA"],
      }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", department: "HR&GA", roles: ["requester"] }),
    )).toBe(true);
  });

  it("user with empty roles sees memo they are CC'd on by email", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        readActions: [{ recipient: "nadda@car-1996.com", status: "pending" }],
      }),
      makeSession({ email: "nadda@car-1996.com", roles: [] }),
    )).toBe(true);
  });

  it("requester-only user does NOT see memo they are not CC'd on", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "สุภาพร เจริญสุข", readRecipients: ["IT"] }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", department: "HR&GA", roles: ["requester"] }),
    )).toBe(false);
  });
});

// ── Multi-role users ──────────────────────────────────────────────────────────

describe("multi-role users", () => {
  it("requester+read-recipient sees own memo via requester rule", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "นัดดา หาญกล้า" }),
      makeSession({
        firstName: "นัดดา", lastName: "หาญกล้า",
        department: "HR&GA",
        roles: ["requester", "read-recipient"],
      }),
    )).toBe(true);
  });

  it("requester+read-recipient sees memo they are a read recipient on (not their memo)", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        requester: "สุภาพร เจริญสุข",
        readRecipients: ["HR&GA"],
      }),
      makeSession({
        firstName: "นัดดา", lastName: "หาญกล้า",
        department: "HR&GA",
        roles: ["requester", "read-recipient"],
      }),
    )).toBe(true);
  });
});

// ── HR&GA department grants no special visibility ────────────────────────────

describe("HR&GA department grants no special visibility", () => {
  it("HR&GA dept + requester role does not see another user's memo", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "สุภาพร เจริญสุข" }),
      makeSession({ department: "HR&GA", roles: ["requester"] }),
    )).toBe(false);
  });

  it("HR&GA dept without admin role has no system-wide visibility", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        requester: "someone else",
        readRecipients: [],
        selectedRoute: ["General Manager"],
        currentStep: "General Manager",
        notifyMD: false,
      }),
      makeSession({
        firstName: "ปิยะนุช", lastName: "บุญมา",
        department: "HR&GA",
        roles: ["read-recipient"],
        approvalLevel: null,
      }),
    )).toBe(false);
  });

  it("HR&GA dept + admin role sees all memos — because of admin role, not department", () => {
    // The visibility comes from roles: ["admin"], not department: "HR&GA"
    expect(isMemoVisibleTo(
      makeMemo({ requester: "someone else" }),
      makeSession({ department: "HR&GA", roles: ["admin"] }),
    )).toBe(true);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty roles array returns false regardless of memo content", () => {
    expect(isMemoVisibleTo(makeMemo(), makeSession({ roles: [] }))).toBe(false);
  });

  it("null approvalLevel with approver-style role returns false for route-only memos", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["General Manager"] }),
      makeSession({ roles: ["general-manager"], approvalLevel: null }),
    )).toBe(false);
  });

  it("unrecognised approvalLevel string is treated as null", () => {
    expect(isMemoVisibleTo(
      makeMemo({ selectedRoute: ["General Manager"] }),
      makeSession({ roles: ["general-manager"], approvalLevel: "Head of Department" as string }),
    )).toBe(false);
  });
});
