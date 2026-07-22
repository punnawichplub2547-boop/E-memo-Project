import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db-users", () => ({
  approveUser: vi.fn(),
  findActiveUsersByApprovalLevel: vi.fn(),
}));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { approveUser, findActiveUsersByApprovalLevel } from "@/lib/db-users";

const ADMIN = { userId: 1, firstName: "A", lastName: "B", roles: ["admin"] };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/users/5/approve", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(ADMIN as never);
});

describe("POST approve — Managing Director duplicate guard", () => {
  it("returns 409 with conflictWith when another active user already holds Managing Director", async () => {
    vi.mocked(findActiveUsersByApprovalLevel).mockResolvedValue([
      { id: 9, email: "md@car-1996.com", first_name: "MD", last_name: "Seed", department: "Executive", employee_card_id: "X", roles_json: "[]", approval_level: "Managing Director", status: "active", created_at: "", updated_at: "" },
    ] as never);

    const res = await POST(req({ roles: ["managing-director"], approvalLevel: "Managing Director" }), ctx("5"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("duplicate-approval-level");
    expect(body.conflictWith).toEqual([{ email: "md@car-1996.com", firstName: "MD", lastName: "Seed" }]);
    expect(vi.mocked(approveUser)).not.toHaveBeenCalled();
  });

  it("approves normally when no conflict exists", async () => {
    vi.mocked(findActiveUsersByApprovalLevel).mockResolvedValue([]);

    const res = await POST(req({ roles: ["managing-director"], approvalLevel: "Managing Director" }), ctx("5"));

    expect(vi.mocked(findActiveUsersByApprovalLevel)).toHaveBeenCalledWith("Managing Director", 5);
    expect(res.status).toBe(200);
    expect(vi.mocked(approveUser)).toHaveBeenCalledWith(5, ["managing-director"], "Managing Director");
  });

  it("proceeds when confirmDuplicateApprovalLevel=true even if a conflict exists", async () => {
    vi.mocked(findActiveUsersByApprovalLevel).mockResolvedValue([
      { id: 9, email: "md@car-1996.com", first_name: "MD", last_name: "Seed", department: "Executive", employee_card_id: "X", roles_json: "[]", approval_level: "Managing Director", status: "active", created_at: "", updated_at: "" },
    ] as never);

    const res = await POST(
      req({ roles: ["managing-director"], approvalLevel: "Managing Director", confirmDuplicateApprovalLevel: true }),
      ctx("5"),
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(approveUser)).toHaveBeenCalledWith(5, ["managing-director"], "Managing Director");
  });

  it("does not check for duplicates for non-MD approval levels", async () => {
    const res = await POST(req({ roles: ["general-manager"], approvalLevel: "General Manager" }), ctx("5"));

    expect(vi.mocked(findActiveUsersByApprovalLevel)).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("does not check for duplicates when approvalLevel is null", async () => {
    const res = await POST(req({ roles: ["requester"], approvalLevel: null }), ctx("5"));

    expect(vi.mocked(findActiveUsersByApprovalLevel)).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
