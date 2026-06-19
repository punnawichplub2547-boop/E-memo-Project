import { describe, expect, it } from "vitest";
import type { MemoRecord, MemoAttachment } from "./approval";
import type { SessionUser } from "./auth-jwt";
import { canDownloadAttachment, canUploadAttachment } from "./attachment-access";

const attachment: MemoAttachment = {
  id: "att-1",
  originalName: "quote.pdf",
  storedName: "uuid-1-quote.pdf",
  size: 1024,
  mimeType: "application/pdf",
  uploadedAt: "01 Jan 2026 10:00",
};

function makeMemo(overrides: Partial<MemoRecord> = {}): MemoRecord {
  return {
    id: "EM-2026-001",
    title: "Test memo",
    requester: "Alice Owner",
    requesterUserId: 10,
    department: "IT",
    category: "general",
    amount: 0,
    status: "pending",
    currentStep: "Manager / Top Section",
    cycleHours: 0,
    createdAt: "01 Jan 2026 09:00",
    updatedAt: "01 Jan 2026 09:00",
    attachments: [attachment],
    ...overrides,
  } as MemoRecord;
}

function makeSession(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: 10,
    employeeCardId: "0001",
    email: "alice@car-1996.com",
    firstName: "Alice",
    lastName: "Owner",
    department: "IT",
    roles: ["requester"],
    approvalLevel: null,
    ...overrides,
  };
}

describe("canDownloadAttachment", () => {
  it("(a) returns true when memo is visible and storedName is listed", () => {
    const memo = makeMemo();
    const session = makeSession(); // requester owns -> visible
    expect(canDownloadAttachment(memo, session, attachment.storedName)).toBe(true);
  });

  it("(b) returns false when memo is visible but storedName is not listed", () => {
    const memo = makeMemo();
    const session = makeSession();
    expect(canDownloadAttachment(memo, session, "uuid-other-file.pdf")).toBe(false);
  });

  it("(c) returns false when memo is not visible to the session", () => {
    const memo = makeMemo();
    // A different requester with no approval/CC relationship cannot see this memo.
    const session = makeSession({
      userId: 99,
      firstName: "Bob",
      lastName: "Stranger",
      email: "bob@car-1996.com",
    });
    expect(canDownloadAttachment(memo, session, attachment.storedName)).toBe(false);
  });

  it("(d) returns false when memo is null", () => {
    const session = makeSession();
    expect(canDownloadAttachment(null, session, attachment.storedName)).toBe(false);
  });

  it("admin can download a listed attachment of any memo", () => {
    const memo = makeMemo({ requesterUserId: 999, requester: "Someone Else" });
    const session = makeSession({ userId: 1, roles: ["admin"] });
    expect(canDownloadAttachment(memo, session, attachment.storedName)).toBe(true);
  });
});

describe("canUploadAttachment", () => {
  it("(a) returns true when memo is null (new memo) and session exists", () => {
    const session = makeSession();
    expect(canUploadAttachment(null, session)).toBe(true);
  });

  it("(b) returns true when the session user owns the memo", () => {
    const memo = makeMemo({ requesterUserId: 10, requester: "Alice Owner" });
    const session = makeSession({ userId: 10 });
    expect(canUploadAttachment(memo, session)).toBe(true);
  });

  it("(c) returns false when the session user is neither owner nor admin", () => {
    const memo = makeMemo({ requesterUserId: 10, requester: "Alice Owner" });
    const session = makeSession({
      userId: 99,
      firstName: "Bob",
      lastName: "Stranger",
      roles: ["requester"],
    });
    expect(canUploadAttachment(memo, session)).toBe(false);
  });

  it("(d) returns true when the session user is admin", () => {
    const memo = makeMemo({ requesterUserId: 10, requester: "Alice Owner" });
    const session = makeSession({ userId: 1, roles: ["admin"] });
    expect(canUploadAttachment(memo, session)).toBe(true);
  });
});
