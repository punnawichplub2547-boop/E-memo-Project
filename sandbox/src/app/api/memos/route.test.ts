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
