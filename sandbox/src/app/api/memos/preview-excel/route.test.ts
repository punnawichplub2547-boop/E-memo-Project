import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
// The route must never reach the database. Mocking getDbPool to throw makes any
// accidental access a loud failure rather than a silent extra query.
vi.mock("@/lib/db", () => ({
  getDbPool: vi.fn(() => {
    throw new Error("the preview route must not touch the database");
  }),
}));
vi.mock("@/lib/export/memo-excel", () => ({ memoToExcelBuffer: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { memoToExcelBuffer } from "@/lib/export/memo-excel";

const USER = { userId: 1, firstName: "A", lastName: "B", roles: ["requester"] };

const MEMO = {
  id: "",
  title: "ขออนุมัติจัดซื้อ",
  requester: "ก ข",
  department: "IT",
  category: "general-purchase",
  amount: 500,
  status: "draft",
  currentStep: "Manager / Top Section",
  requestItems: [],
  priceComparisons: [],
  cycleHours: 0,
  createdAt: "06 Aug 2026 10:11",
  updatedAt: "06 Aug 2026 10:11",
};

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/memos/preview-excel", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(USER as never);
  vi.mocked(memoToExcelBuffer).mockResolvedValue(Buffer.from("xlsx-bytes") as never);
});

describe("POST /api/memos/preview-excel", () => {
  it("401 without a session, and never builds a workbook", async () => {
    vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(null);
    const res = await POST(req({ memo: MEMO }));
    expect(res.status).toBe(401);
    expect(vi.mocked(memoToExcelBuffer)).not.toHaveBeenCalled();
  });

  it("200 with the spreadsheet content type for a valid draft record", async () => {
    const res = await POST(req({ memo: MEMO }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(res.headers.get("content-disposition")).toContain("memo-draft.xlsx");
    expect(vi.mocked(memoToExcelBuffer)).toHaveBeenCalledTimes(1);
  });

  it("renders with no signatures — nothing has been approved yet", async () => {
    await POST(req({ memo: MEMO }));
    expect(vi.mocked(memoToExcelBuffer).mock.calls[0][1]).toEqual([]);
  });

  it("names the file after the memo when one already has a number", async () => {
    const res = await POST(req({ memo: { ...MEMO, id: "EM-2026-002" } }));
    expect(res.headers.get("content-disposition")).toContain("memo-EM-2026-002.xlsx");
  });

  it("never queries the database", async () => {
    const res = await POST(req({ memo: MEMO }));
    expect(res.status).toBe(200);
    expect(vi.mocked(getDbPool)).not.toHaveBeenCalled();
  });

  it("400 when the body is not JSON", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(vi.mocked(memoToExcelBuffer)).not.toHaveBeenCalled();
  });

  it("400 when memo is missing or not an object", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ memo: null }))).status).toBe(400);
    expect((await POST(req({ memo: "EM-2026-002" }))).status).toBe(400);
    expect(vi.mocked(memoToExcelBuffer)).not.toHaveBeenCalled();
  });

  it("400 when a required scalar field has the wrong type", async () => {
    const res = await POST(req({ memo: { ...MEMO, amount: "500" } }));
    expect(res.status).toBe(400);
    expect(vi.mocked(memoToExcelBuffer)).not.toHaveBeenCalled();
  });

  it("400 when a collection is longer than the row cap", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ id: String(i), name: "x", unit: "", qty: 1, unitPrice: 1 }));
    const res = await POST(req({ memo: { ...MEMO, requestItems: rows } }));
    expect(res.status).toBe(400);
    expect(vi.mocked(memoToExcelBuffer)).not.toHaveBeenCalled();
  });

  it("accepts a collection exactly at the cap", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: "x", unit: "", qty: 1, unitPrice: 1 }));
    const res = await POST(req({ memo: { ...MEMO, priceComparisons: rows } }));
    expect(res.status).toBe(200);
  });

  it("500 when the generator throws, without leaking the message", async () => {
    vi.mocked(memoToExcelBuffer).mockRejectedValue(new Error("boom: /secret/path"));
    const res = await POST(req({ memo: MEMO }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
