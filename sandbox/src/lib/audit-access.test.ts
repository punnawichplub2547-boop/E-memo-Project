import { describe, it, expect } from "vitest";
import { canViewAuditTrail } from "./audit-access";

describe("canViewAuditTrail", () => {
  it("allows admin", () => {
    expect(canViewAuditTrail(["admin"])).toBe(true);
  });

  it("allows managing-director", () => {
    expect(canViewAuditTrail(["managing-director"])).toBe(true);
  });

  it("allows a user holding both admin and managing-director", () => {
    expect(canViewAuditTrail(["managing-director", "admin"])).toBe(true);
  });

  it("allows managing-director even alongside lower roles", () => {
    expect(canViewAuditTrail(["requester", "managing-director"])).toBe(true);
  });

  it("denies general-manager", () => {
    expect(canViewAuditTrail(["general-manager"])).toBe(false);
  });

  it("denies manager", () => {
    expect(canViewAuditTrail(["manager"])).toBe(false);
  });

  it("denies requester", () => {
    expect(canViewAuditTrail(["requester"])).toBe(false);
  });

  it("denies read-recipient", () => {
    expect(canViewAuditTrail(["read-recipient"])).toBe(false);
  });

  it("denies an empty role list", () => {
    expect(canViewAuditTrail([])).toBe(false);
  });

  it("denies null / undefined", () => {
    expect(canViewAuditTrail(null)).toBe(false);
    expect(canViewAuditTrail(undefined)).toBe(false);
  });
});
