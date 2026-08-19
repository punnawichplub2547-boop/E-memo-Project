import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getActiveSessionUserFromToken: vi.fn() }));
vi.mock("@/lib/auth-jwt", () => ({ COOKIE_NAME: "em-session" }));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));
vi.mock("@/lib/custom-route-server", () => ({ resolveCustomRouteFromRequest: vi.fn() }));
vi.mock("@/lib/db-users", () => ({ departmentHasActiveSupervisor: vi.fn() }));
vi.mock("@/lib/notify-memo-event", () => ({ notifyMemoEvent: vi.fn() }));

import { POST } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { resolveCustomRouteFromRequest } from "@/lib/custom-route-server";
import { departmentHasActiveSupervisor } from "@/lib/db-users";
import { notifyMemoEvent } from "@/lib/notify-memo-event";
import { memoToDbSeedRow } from "@/lib/db-seed";
import type { MemoRecord } from "@/lib/approval";

const SESSION = { userId: 7, firstName: "ปุณณวิช", lastName: "ภูประเสริฐ", roles: ["requester"], department: "IT" };

// The memo being revised: owned by the session user and in a state that allows a revision,
// so the request reaches the routing code rather than dying on an earlier guard.
const MEMO_ROW = {
  id: 11,
  requester_name: "ปุณณวิช ภูประเสริฐ",
  requester_user_id: 7,
  status: "returned",
  reject_disposition: null,
  revision_no: 1,
  return_to_step: null,
  form_mode: "standard",
};

const execute = vi.fn();
const commit = vi.fn();
const rollback = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSessionUserFromToken).mockResolvedValue(SESSION as never);
  vi.mocked(departmentHasActiveSupervisor).mockResolvedValue(false as never);
  // The handler fires this after commit and chains .catch() onto it.
  vi.mocked(notifyMemoEvent).mockResolvedValue(undefined as never);
  execute.mockResolvedValue([[MEMO_ROW], undefined]);
  commit.mockResolvedValue(undefined);
  // The handler chains .catch() onto rollback(), so it must be thenable.
  rollback.mockResolvedValue(undefined);
  const connection = {
    execute,
    beginTransaction: vi.fn(),
    commit,
    rollback,
    release: vi.fn(),
  };
  vi.mocked(getDbPool).mockReturnValue({ getConnection: vi.fn().mockResolvedValue(connection) } as never);
});

function makeMemo(overrides: Partial<MemoRecord> = {}): MemoRecord {
  return {
    id: "EM-2026-011",
    title: "ขออนุมัติซื้อวัตถุดิบ",
    requester: "ปุณณวิช ภูประเสริฐ",
    department: "IT",
    category: "general-purchase",
    amount: 15000,
    status: "pending",
    currentStep: "General Manager",
    cycleHours: 0,
    createdAt: "01 Jan 2026 09:00",
    updatedAt: "01 Jan 2026 09:00",
    ...overrides,
  };
}

function postRevision(memo: MemoRecord, customRoute?: unknown, extra: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/memos/EM-2026-011/submit-revision", {
    method: "POST",
    body: JSON.stringify({
      oldRevisionNo: 1,
      source: "return",
      returnReason: "แก้ราคา",
      rejectReason: null,
      revisionNote: "แก้แล้ว",
      oldSubmittedAt: "01 Jan 2026 09:00",
      snapshotJson: "{}",
      nextMemoRow: memoToDbSeedRow(memo),
      readRecipients: [],
      actorName: null,
      customRoute,
      ...extra,
    }),
    headers: { "content-type": "application/json", cookie: "em-session=token" },
  });
}

const params = Promise.resolve({ id: "EM-2026-011" });

// Same trust boundary as POST /api/memos: only resolveCustomRouteFromRequest may mint a
// person token, because canActOnStep authorizes an approver by reading the user id out of
// the step string. A revision that smuggles tokens past the resolver would hand the memo
// to a user of the client's choosing and leave route_mode/custom_route_json inconsistent.
describe("POST /api/memos/[id]/submit-revision forged custom route tokens", () => {
  it("answers 400 when the revision's selectedRoute carries a forged token", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(
      postRevision(makeMemo({ selectedRoute: ["person:1#999", "person:2#998"] })),
      { params },
    );

    expect(res.status).toBe(400);
    expect(commit).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalled();
  });

  it("answers 400 for a mixed level/token route", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(
      postRevision(makeMemo({
        selectedRoute: ["person:1#999", "Managing Director"],
        recommendedRoute: ["Managing Director"],
      })),
      { params },
    );

    expect(res.status).toBe(400);
    expect(commit).not.toHaveBeenCalled();
  });

  it("leaves a plain Book1 revision alone", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(
      postRevision(makeMemo({ selectedRoute: ["General Manager"], recommendedRoute: ["General Manager"] })),
      { params },
    );

    expect(res.status).toBe(200);
    expect(commit).toHaveBeenCalled();
  });

  // A genuine custom revision sends tokens in selectedRoute too — the difference is that it
  // also sends customRoute, so the resolver rebuilds both from the users table. The guard
  // must not fire on that path or per-person revisions become impossible.
  it("accepts a resolved custom route even though it is all tokens", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({
      status: "ok",
      route: ["person:1#42"],
      approvers: [{ stepKey: "person:1#42", userId: 42, name: "สมชาย ใจดี", approvalLevel: null, department: "IT" }],
    } as never);

    const res = await POST(
      postRevision(makeMemo({ selectedRoute: ["person:1#42"] }), [{ userId: 42 }]),
      { params },
    );

    expect(res.status).toBe(200);
    expect(commit).toHaveBeenCalled();
  });

  it("still answers 400 with the resolver's own message when the route cannot be honoured", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({
      status: "invalid",
      message: "ไม่สามารถส่งได้: สมชาย ใจดี ไม่อยู่ในระบบแล้ว",
    } as never);

    const res = await POST(
      postRevision(makeMemo({ selectedRoute: ["person:1#42"] }), [{ userId: 42 }]),
      { params },
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("สมชาย ใจดี");
    expect(commit).not.toHaveBeenCalled();
  });
});

// V3 free-form memo body: resolveBodyBlocksFromRequest (Task 6) is the trust boundary;
// this route must lock the form mode across a revision (Q5) and turn the resolver's
// clear* flags into a real UPDATE, not merely read them.
describe("POST /api/memos/[id]/submit-revision free-form body blocks", () => {
  it("refuses to switch a standard memo to free-form on resubmit", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(
      postRevision(
        makeMemo({ selectedRoute: ["General Manager"], recommendedRoute: ["General Manager"] }),
        undefined,
        { formMode: "freeform", bodyBlocks: [] },
      ),
      { params },
    );

    expect(res.status).toBe(400);
    expect(commit).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalled();
  });

  it("clears the price data on a revision when the price block was removed", async () => {
    execute.mockResolvedValue([[{ ...MEMO_ROW, form_mode: "freeform" }], undefined]);
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({
      status: "ok",
      route: ["person:1#42"],
      approvers: [{ stepKey: "person:1#42", userId: 42, name: "สมชาย ใจดี", approvalLevel: null, department: "IT" }],
    } as never);

    const memo = makeMemo({
      selectedRoute: ["person:1#42"],
      priceComparisons: [
        { id: "pc1", vendorName: "A", offeredPrice: 100, discount: 0, netPrice: 100, isSelected: true },
      ],
    });
    const res = await POST(
      postRevision(memo, [{ userId: 42 }], {
        formMode: "freeform",
        bodyBlocks: [{ id: "b1", type: "paragraph", text: "x" }],
      }),
      { params },
    );

    expect(res.status).toBe(200);
    const update = execute.mock.calls.find(([sql]) => String(sql).includes("UPDATE memos SET"));
    expect(update).toBeDefined();
    const sql = String(update![0]);
    const updateParams = update![1] as unknown[];
    const index = sql.slice(0, sql.indexOf("WHERE")).split(",").findIndex((c) => c.includes("price_comparisons_json"));
    expect(updateParams[index]).toBeNull();
  });
});
