import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));

vi.mock("@/lib/db-dispatches", () => ({
  createDispatch: vi.fn(),
  getSentDispatches: vi.fn(),
  getReceivedDispatches: vi.fn(),
  getDispatchDetails: vi.fn(),
  markDispatchAsRead: vi.fn(),
  acknowledgeDispatch: vi.fn(),
}));

import { POST, GET } from "./route";
import { GET as GET_DETAILS } from "./[id]/route";
import { PUT as PUT_READ } from "./[id]/read/route";
import { PUT as PUT_ACK } from "./[id]/acknowledge/route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import {
  createDispatch,
  getSentDispatches,
  getReceivedDispatches,
  getDispatchDetails,
  markDispatchAsRead,
  acknowledgeDispatch,
} from "@/lib/db-dispatches";

const USER = { userId: 1, firstName: "Test", lastName: "User", roles: ["requester"] };

const originalFlag = process.env.DISPATCH_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
  process.env.DISPATCH_ENABLED = "true";
});

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.DISPATCH_ENABLED;
  } else {
    process.env.DISPATCH_ENABLED = originalFlag;
  }
});

describe("Dispatches API Routes", () => {
  describe("POST /api/dispatches", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/dispatches", {
        method: "POST",
        body: JSON.stringify({ subject: "A", content: "B", recipients: [] }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when parameters are missing", async () => {
      const req = new NextRequest("http://localhost/api/dispatches", {
        method: "POST",
        body: JSON.stringify({ content: "B", recipients: [] }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Subject is required");
    });

    it("creates dispatch successfully", async () => {
      vi.mocked(createDispatch).mockResolvedValue(45);
      const req = new NextRequest("http://localhost/api/dispatches", {
        method: "POST",
        body: JSON.stringify({
          subject: "Test Circular",
          content: "Please acknowledge.",
          recipients: [{ type: "user", targetId: 10 }],
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.id).toBe(45);
      expect(createDispatch).toHaveBeenCalledWith(1, {
        subject: "Test Circular",
        content: "Please acknowledge.",
        memoId: null,
        attachments: undefined,
        recipients: [{ type: "user", targetId: 10 }],
      });
    });
  });

  describe("GET /api/dispatches", () => {
    it("returns inbox dispatches by default", async () => {
      const mockInbox = [{ id: 45, subject: "Inbox Item" }];
      vi.mocked(getReceivedDispatches).mockResolvedValue(mockInbox);

      const req = new NextRequest("http://localhost/api/dispatches");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.dispatches).toEqual(mockInbox);
      expect(getReceivedDispatches).toHaveBeenCalledWith(1);
    });

    it("returns sent dispatches when mode=sent", async () => {
      const mockSent = [{ id: 46, subject: "Sent Item" }];
      vi.mocked(getSentDispatches).mockResolvedValue(mockSent);

      const req = new NextRequest("http://localhost/api/dispatches?mode=sent");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.dispatches).toEqual(mockSent);
      expect(getSentDispatches).toHaveBeenCalledWith(1);
    });
  });

  describe("GET /api/dispatches/[id]", () => {
    const ctx = { params: Promise.resolve({ id: "45" }) };

    it("returns 403 when user is neither sender nor recipient", async () => {
      const mockDispatch = { senderUserId: 99, recipients: [{ targetUserId: 88 }] };
      vi.mocked(getDispatchDetails).mockResolvedValue(mockDispatch);

      const req = new NextRequest("http://localhost/api/dispatches/45");
      const res = await GET_DETAILS(req, ctx);
      expect(res.status).toBe(403);
    });

    it("returns details when user is the sender", async () => {
      const mockDispatch = { senderUserId: 1, recipients: [{ targetUserId: 88 }] };
      vi.mocked(getDispatchDetails).mockResolvedValue(mockDispatch);

      const req = new NextRequest("http://localhost/api/dispatches/45");
      const res = await GET_DETAILS(req, ctx);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.dispatch).toEqual(mockDispatch);
    });
  });

  describe("PUT /api/dispatches/[id]/read", () => {
    const ctx = { params: Promise.resolve({ id: "45" }) };

    it("marks dispatch as read", async () => {
      const req = new NextRequest("http://localhost/api/dispatches/45/read", { method: "PUT" });
      const res = await PUT_READ(req, ctx);
      expect(res.status).toBe(200);
      expect(markDispatchAsRead).toHaveBeenCalledWith(45, 1);
    });
  });

  describe("PUT /api/dispatches/[id]/acknowledge", () => {
    const ctx = { params: Promise.resolve({ id: "45" }) };

    it("acknowledges dispatch with notes successfully", async () => {
      vi.mocked(acknowledgeDispatch).mockResolvedValue(true);
      const req = new NextRequest("http://localhost/api/dispatches/45/acknowledge", {
        method: "PUT",
        body: JSON.stringify({ notes: "Understood" }),
      });
      const res = await PUT_ACK(req, ctx);
      expect(res.status).toBe(200);
      expect(acknowledgeDispatch).toHaveBeenCalledWith(45, 1, "Understood");
    });
  });
});

describe("Dispatches API Routes with the feature flag off", () => {
  const ctx = { params: Promise.resolve({ id: "45" }) };

  beforeEach(() => {
    delete process.env.DISPATCH_ENABLED;
  });

  it("hides POST /api/dispatches behind a 404 and never creates anything", async () => {
    const req = new NextRequest("http://localhost/api/dispatches", {
      method: "POST",
      body: JSON.stringify({
        subject: "Test Circular",
        content: "Please acknowledge.",
        recipients: [{ type: "user", targetId: 10 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(createDispatch).not.toHaveBeenCalled();
  });

  it("hides GET /api/dispatches behind a 404 and never queries", async () => {
    const req = new NextRequest("http://localhost/api/dispatches");
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(getReceivedDispatches).not.toHaveBeenCalled();
    expect(getSentDispatches).not.toHaveBeenCalled();
  });

  it("hides GET /api/dispatches/[id] behind a 404 and never queries", async () => {
    const req = new NextRequest("http://localhost/api/dispatches/45");
    const res = await GET_DETAILS(req, ctx);
    expect(res.status).toBe(404);
    expect(getDispatchDetails).not.toHaveBeenCalled();
  });

  it("hides PUT /api/dispatches/[id]/read behind a 404 and never writes", async () => {
    const req = new NextRequest("http://localhost/api/dispatches/45/read", { method: "PUT" });
    const res = await PUT_READ(req, ctx);
    expect(res.status).toBe(404);
    expect(markDispatchAsRead).not.toHaveBeenCalled();
  });

  it("hides PUT /api/dispatches/[id]/acknowledge behind a 404 and never writes", async () => {
    const req = new NextRequest("http://localhost/api/dispatches/45/acknowledge", {
      method: "PUT",
      body: JSON.stringify({ notes: "Understood" }),
    });
    const res = await PUT_ACK(req, ctx);
    expect(res.status).toBe(404);
    expect(acknowledgeDispatch).not.toHaveBeenCalled();
  });

  it("returns the same 404 for an unauthenticated caller, leaking nothing", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/dispatches");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
