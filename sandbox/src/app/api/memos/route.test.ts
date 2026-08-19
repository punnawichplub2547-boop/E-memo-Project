import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { MemoSeedRow } from "@/lib/db-seed";

vi.mock("@/lib/auth", () => ({
  getActiveSessionUserFromToken: vi.fn(),
  COOKIE_NAME: "em-session",
}));
vi.mock("@/lib/db", () => ({ getDbPool: vi.fn() }));
vi.mock("@/lib/custom-route-server", () => ({ resolveCustomRouteFromRequest: vi.fn() }));
vi.mock("@/lib/db-users", () => ({ departmentHasActiveSupervisor: vi.fn() }));
vi.mock("@/lib/notify-memo-event", () => ({ notifyMemoEvent: vi.fn() }));

import { POST, memoRowParams } from "./route";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { resolveCustomRouteFromRequest } from "@/lib/custom-route-server";
import { departmentHasActiveSupervisor } from "@/lib/db-users";
import { notifyMemoEvent } from "@/lib/notify-memo-event";

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
  vi.mocked(notifyMemoEvent).mockResolvedValue(undefined as never);
});

// Shared connection.execute mock for tests that need POST to reach the real INSERT —
// most tests in this file stop earlier (getDbPool() returns {} so pool.getConnection
// throws), but the free-form body-block tests below must inspect the actual INSERT
// SQL/params, so they need a full, successful DB round trip.
const execute = vi.fn();
function mockSuccessfulInsert() {
  execute.mockResolvedValue([{ insertId: 55 }, undefined]);
  const connection = {
    execute,
    beginTransaction: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  vi.mocked(getDbPool).mockReturnValue({ getConnection: vi.fn().mockResolvedValue(connection) } as never);
  return connection;
}

const CUSTOM_ROUTE_OK = {
  status: "ok",
  route: ["person:1#42"],
  approvers: [{ stepKey: "person:1#42", userId: 42, name: "สมชาย ใจดี", approvalLevel: null, department: "IT" }],
};

const validFreeformPayload = {
  status: "pending",
  title: "บันทึกอิสระ",
  department: "IT",
  category: "general-purchase",
  amount: 1000,
  customRoute: [{ userId: 42 }],
};

const validPayloadWithBook1Route = {
  status: "pending",
  title: "ขอซื้อวัสดุสำนักงาน",
  department: "IT",
  category: "general-purchase",
  amount: 1000,
  selectedRoute: ["General Manager"],
};

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

// ป้องกันบั๊กคลาสที่โปรเจกต์นี้เจอซ้ำ: เพิ่มคอลัมน์ใน INSERT แต่ลืมเพิ่มใน memoRowParams
// (หรือกลับกัน) แล้วค่าเลื่อนคอลัมน์กันทั้งแถวโดยไม่มีเทสต์ตัวไหนแดง
//
// This is a BEHAVIOURAL test: it calls the real memoRowParams() and checks its
// output, not the source text of route.ts (a source-text/regex test breaks on
// reformatting and never actually exercises the code). FIXTURE_ROW below is
// written in exactly the field order MemoSeedRow declares (src/lib/db-seed.ts),
// which is also the column order the INSERT statement writes them in — every
// field gets its own distinctive sentinel value so a one-position shift (a
// column added to the INSERT/params but its neighbour's value now lands one
// slot over) fails loudly and points at exactly which value moved.
describe("POST /api/memos INSERT wiring", () => {
  const FIXTURE_ROW: MemoSeedRow = {
    memo_no: "sentinel:memo_no",
    title: "sentinel:title",
    requester_name: "sentinel:requester_name",
    requester_user_id: 101,
    department_name: "sentinel:department_name",
    category: "sentinel:category",
    item_subcategory_id: 102,
    item_subcategory_label: "sentinel:item_subcategory_label",
    amount: 103,
    budget_status: "sentinel:budget_status",
    account_code: "sentinel:account_code",
    budget_plan: 104,
    budget_used: 105,
    description: "sentinel:description",
    closing_remark: "sentinel:closing_remark",
    notify_note: "sentinel:notify_note",
    notify_note_images_json: "sentinel:notify_note_images_json",
    notify_attach_excel: 106,
    status: "sentinel:status",
    workflow_state: "sentinel:workflow_state",
    current_step: "sentinel:current_step",
    cycle_hours: 107,
    recommended_final_approver: "sentinel:recommended_final_approver",
    recommended_route_json: "sentinel:recommended_route_json",
    selected_route_json: "sentinel:selected_route_json",
    custom_route_json: "sentinel:custom_route_json",
    route_mode: "sentinel:route_mode",
    route_override_reason: "sentinel:route_override_reason",
    notify_md: true,
    requires_md_review: false,
    md_review_status: "sentinel:md_review_status",
    md_review_resume_step: "sentinel:md_review_resume_step",
    md_review_comment: "sentinel:md_review_comment",
    md_review_acted_by: "sentinel:md_review_acted_by",
    md_review_acted_at: "sentinel:md_review_acted_at",
    is_price_adjustment: true,
    follows_production_plan: false,
    is_dead_stock: true,
    dept_monthly_over_budget_total: 108,
    return_reason: "sentinel:return_reason",
    reject_reason: "sentinel:reject_reason",
    reject_disposition: "sentinel:reject_disposition",
    revision_no: 109,
    revision_submitted_at: "sentinel:revision_submitted_at",
    revision_note: "sentinel:revision_note",
    price_comparisons_json: "sentinel:price_comparisons_json",
    selected_vendor_id: "sentinel:selected_vendor_id",
    selected_vendor_reason: "sentinel:selected_vendor_reason",
    price_adjustment_reason: "sentinel:price_adjustment_reason",
    request_items_json: "sentinel:request_items_json",
    read_recipients_json: "sentinel:read_recipients_json",
    attachments_json: "sentinel:attachments_json",
    form_mode: "freeform",
    body_blocks_json: "sentinel:body_blocks_json",
    created_at: "sentinel:created_at",
    updated_at: "sentinel:updated_at",
  };
  // Object key order is insertion order for string keys — this is the same
  // order FIXTURE_ROW is declared in above, kept in lockstep with MemoSeedRow.
  const EXPECTED_COLUMN_ORDER = Object.keys(FIXTURE_ROW) as (keyof MemoSeedRow)[];

  it("returns exactly one param per MemoSeedRow field, in column order", () => {
    const params = memoRowParams(FIXTURE_ROW);
    expect(params).toHaveLength(EXPECTED_COLUMN_ORDER.length);
    EXPECTED_COLUMN_ORDER.forEach((key, index) => {
      expect(params[index], `params[${index}] should be row.${key}`).toBe(FIXTURE_ROW[key]);
    });
  });

  it("places the 3 short-note params immediately after closing_remark, unshifted", () => {
    const params = memoRowParams(FIXTURE_ROW);
    const closingRemarkIndex = EXPECTED_COLUMN_ORDER.indexOf("closing_remark");

    expect(params[closingRemarkIndex]).toBe("sentinel:closing_remark");
    expect(params[closingRemarkIndex + 1]).toBe("sentinel:notify_note");
    expect(params[closingRemarkIndex + 2]).toBe("sentinel:notify_note_images_json");
    expect(params[closingRemarkIndex + 3]).toBe(106); // notify_attach_excel
    expect(params[closingRemarkIndex + 4]).toBe("sentinel:status"); // next real column, unshifted
  });
});

// V3 free-form memo body: resolveBodyBlocksFromRequest is the trust boundary
// (Task 6). These tests prove POST /api/memos actually wires it in — persists what
// it returns, refuses what it rejects, and turns its clear* flags into real nulled
// DB columns rather than silently discarding them.
describe("POST /api/memos free-form body blocks", () => {
  it("stores the form mode and blocks a free-form memo submits", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue(CUSTOM_ROUTE_OK as never);
    mockSuccessfulInsert();

    const res = await POST(postMemo({
      ...validFreeformPayload,
      formMode: "freeform",
      bodyBlocks: [{ id: "b1", type: "paragraph", text: "เนื้อหาอิสระ" }],
    }));

    expect(res.status).toBe(201);
    const insert = execute.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO memos"));
    expect(insert).toBeDefined();
    expect(String(insert![0])).toContain("form_mode");
    expect(String(insert![0])).toContain("body_blocks_json");
  });

  it("refuses a free-form memo that did not pick its own approvers", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue({ status: "none" } as never);

    const res = await POST(postMemo({
      ...validPayloadWithBook1Route,
      formMode: "freeform",
      bodyBlocks: [],
    }));

    expect(res.status).toBe(400);
    // The rejection must not fall through to a partial write.
    expect(execute).not.toHaveBeenCalled();
  });

  it("clears the price data when the price block was removed", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue(CUSTOM_ROUTE_OK as never);
    mockSuccessfulInsert();

    const res = await POST(postMemo({
      ...validFreeformPayload,
      formMode: "freeform",
      bodyBlocks: [{ id: "b1", type: "paragraph", text: "x" }],
      priceComparisons: [{ vendor: "A", price: 100 }],
    }));

    expect(res.status).toBe(201);
    const insert = execute.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO memos"));
    const params = insert![1] as unknown[];
    const sql = String(insert![0]);
    const index = sql.slice(0, sql.indexOf("VALUES")).split(",").findIndex((c) => c.includes("price_comparisons_json"));
    expect(params[index]).toBeNull();
  });

  it("keeps the price data when a system block still points at it", async () => {
    vi.mocked(resolveCustomRouteFromRequest).mockResolvedValue(CUSTOM_ROUTE_OK as never);
    mockSuccessfulInsert();

    const res = await POST(postMemo({
      ...validFreeformPayload,
      formMode: "freeform",
      bodyBlocks: [{ id: "s1", type: "system", ref: "priceComparison" }],
      priceComparisons: [{ vendor: "A", price: 100 }],
    }));

    expect(res.status).toBe(201);
    const insert = execute.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO memos"));
    const params = insert![1] as unknown[];
    const sql = String(insert![0]);
    const index = sql.slice(0, sql.indexOf("VALUES")).split(",").findIndex((c) => c.includes("price_comparisons_json"));
    expect(params[index]).not.toBeNull();
  });
});
