import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db-item-subcategories", () => ({
  deleteItemSubcategory: vi.fn(),
  setItemSubcategoryActive: vi.fn(),
  updateItemSubcategory: vi.fn(),
}));

import { DELETE } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { deleteItemSubcategory } from "@/lib/db-item-subcategories";

const ADMIN = { userId: 1, firstName: "A", lastName: "B", roles: ["admin"] };
function req(): NextRequest {
  return new NextRequest("http://localhost/api/admin/item-subcategories/5", { method: "DELETE" });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(ADMIN as never);
});

describe("DELETE /api/admin/item-subcategories/[id]", () => {
  it("403 when not admin", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue({ ...ADMIN, roles: ["requester"] } as never);
    expect((await DELETE(req(), ctx("5"))).status).toBe(403);
    expect(vi.mocked(deleteItemSubcategory)).not.toHaveBeenCalled();
  });

  it("400 on invalid id", async () => {
    expect((await DELETE(req(), ctx("abc"))).status).toBe(400);
  });

  it("200 and deletes when admin", async () => {
    const res = await DELETE(req(), ctx("5"));
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteItemSubcategory)).toHaveBeenCalledWith(5);
  });
});
