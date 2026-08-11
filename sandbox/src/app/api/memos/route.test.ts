import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));
vi.mock("@/lib/custom-route-server", () => ({ resolveCustomRouteFromRequest: vi.fn() }));
vi.mock("@/lib/db-users", () => ({ departmentHasActiveSupervisor: vi.fn() }));
vi.mock("@/lib/notify-memo-event", () => ({ notifyMemoEvent: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { resolveCustomRouteFromRequest } from "@/lib/custom-route-server";
import { departmentHasActiveSupervisor } from "@/lib/db-users";

const SESSION = { userId: 7, firstName: "ปุณณวิช", lastName: "ภูประเสริฐ", roles: ["requester"], department: "IT" };

function postMemo(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/memos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: "em-session=token" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(SESSION as never);
  vi.mocked(getDbPool).mockReturnValue({} as never);
  vi.mocked(departmentHasActiveSupervisor).mockResolvedValue(false as never);
});

// The resolver refuses a custom route naming someone who is no longer active,
// because silently falling back would send the document down a completely
// different chain of approvers than the requester picked, with nothing on
// screen saying so. The route handler must surface that refusal as a 400.
describe("POST /api/memos custom route refusal", () => {
  it("answers 400 with the resolver's message when the custom route cannot be honoured", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({
      status: "invalid",
      message: "ไม่สามารถส่งได้: สมชาย ใจดี ไม่อยู่ในระบบแล้ว กรุณาเลือกผู้อนุมัติใหม่",
    } as never);

    const res = await POST(postMemo({ department: "IT", customRoute: [{ userId: 42 }] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("สมชาย ใจดี");
  });

  it("never reaches the Supervisor routing path when it refuses", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({
      status: "invalid",
      message: "รูปแบบรายชื่อผู้อนุมัติไม่ถูกต้อง",
    } as never);

    await POST(postMemo({ department: "IT", customRoute: [{ userId: 0 }] }));

    expect(vi.mocked(departmentHasActiveSupervisor)).not.toHaveBeenCalled();
  });

  // A person token is an authorization primitive: canActOnStep reads the approver's
  // user id straight out of the step string. Only resolveCustomRouteFromRequest may
  // mint one. Posting tokens without a customRoute skipped the resolver entirely
  // ("none" → the level-route branch), and the raw tokens were written to
  // selected_route_json + current_step: an arbitrary or non-existent user became the
  // approver, route_mode stayed "recommended" so the audit trail lied, and a mixed
  // route defeated isCustomRoute so the Q23 reject rule and the MD gate went quiet.
  it("answers 400 when selectedRoute carries a forged person token", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(postMemo({
      status: "pending",
      department: "IT",
      selectedRoute: ["person:1#999", "person:2#998"],
    }));

    expect(res.status).toBe(400);
    expect(vi.mocked(departmentHasActiveSupervisor)).not.toHaveBeenCalled();
  });

  it("answers 400 for a mixed level/token route", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(postMemo({
      status: "pending",
      department: "IT",
      selectedRoute: ["person:1#999", "Managing Director"],
      recommendedRoute: ["Managing Director"],
    }));

    expect(res.status).toBe(400);
  });

  it("answers 400 when only recommendedRoute carries a forged token", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(postMemo({
      status: "pending",
      department: "IT",
      selectedRoute: ["General Manager"],
      recommendedRoute: ["person:1#999"],
    }));

    expect(res.status).toBe(400);
  });

  it("does not refuse a plain Book1 memo that carries no custom route", async () => {
    // status "none" is the classic level-route path; it must behave exactly as
    // before this feature existed. It fails later on the mocked DB, and that is
    // fine - the assertion here is only that it is not turned into a 400.
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(postMemo({
      status: "pending",
      department: "IT",
      selectedRoute: ["General Manager"],
    }));

    expect(res.status).not.toBe(400);
    expect(vi.mocked(departmentHasActiveSupervisor)).toHaveBeenCalled();
  });
});
