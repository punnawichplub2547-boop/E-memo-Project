import { describe, expect, it } from "vitest";
import {
  actorDisplayName,
  buildActionMetadata,
  calculateNextStep,
  canActOnStep,
  evaluateApproveAction,
  evaluateRejectAction,
  evaluateReturnAction,
  nowMysqlUtcDateTime,
  parseRouteJson,
  type WorkflowActorRow,
  type WorkflowMemoRow,
} from "./workflow-rules";

const FULL_ROUTE = ["Manager / Top Section", "General Manager", "Managing Director"];

describe("canActOnStep", () => {
  it("manager can act at Manager / Top Section step", () => {
    expect(
      canActOnStep(
        { roles: ["manager"], approval_level: "Manager / Top Section" },
        "Manager / Top Section",
      ),
    ).toBe(true);
  });

  it("manager cannot act at General Manager step", () => {
    expect(
      canActOnStep(
        { roles: ["manager"], approval_level: "Manager / Top Section" },
        "General Manager",
      ),
    ).toBe(false);
  });

  it("GM can act at General Manager step", () => {
    expect(
      canActOnStep(
        { roles: ["general-manager"], approval_level: "General Manager" },
        "General Manager",
      ),
    ).toBe(true);
  });

  it("admin can act at any step", () => {
    expect(
      canActOnStep({ roles: ["admin", "requester"], approval_level: null }, "Managing Director"),
    ).toBe(true);
  });

  it("null approval_level without admin role grants nothing", () => {
    expect(
      canActOnStep({ roles: ["requester"], approval_level: null }, "Manager / Top Section"),
    ).toBe(false);
  });

  it("HR&GA-style user with no admin role and no approval_level cannot act (department is never checked)", () => {
    // canActOnStep deliberately has no department parameter — department name
    // alone must never grant workflow power (CLAUDE.md role/visibility decision).
    expect(
      canActOnStep({ roles: ["requester", "read-recipient"], approval_level: null }, "General Manager"),
    ).toBe(false);
  });
});

describe("parseRouteJson", () => {
  it("parses a JSON string route", () => {
    expect(parseRouteJson(JSON.stringify(FULL_ROUTE))).toEqual(FULL_ROUTE);
  });

  it("accepts an already-parsed array (mysql2 JSON column)", () => {
    expect(parseRouteJson([...FULL_ROUTE])).toEqual(FULL_ROUTE);
  });

  it("returns null for null, invalid JSON, empty arrays, and non-string entries", () => {
    expect(parseRouteJson(null)).toBeNull();
    expect(parseRouteJson("not-json{")).toBeNull();
    expect(parseRouteJson("[]")).toBeNull();
    expect(parseRouteJson([1, 2])).toBeNull();
    expect(parseRouteJson({ steps: FULL_ROUTE })).toBeNull();
  });
});

describe("calculateNextStep", () => {
  it("advances to the next route step and stays pending", () => {
    const result = calculateNextStep(JSON.stringify(FULL_ROUTE), "General Manager");
    expect(result).toEqual({
      ok: true,
      isFinal: false,
      nextCurrentStep: "Managing Director",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
    });
  });

  it("final step approves and keeps the final approver label", () => {
    const result = calculateNextStep(JSON.stringify(FULL_ROUTE), "Managing Director");
    expect(result).toEqual({
      ok: true,
      isFinal: true,
      nextCurrentStep: "Managing Director",
      nextStatus: "approved",
      nextWorkflowState: "Approved",
    });
  });

  it("errors when the route is missing", () => {
    const result = calculateNextStep(null, "General Manager");
    expect(result.ok).toBe(false);
  });

  it("errors when the current step is not in the route", () => {
    const result = calculateNextStep(JSON.stringify(["Manager / Top Section"]), "General Manager");
    expect(result.ok).toBe(false);
  });
});

describe("buildActionMetadata", () => {
  it("includes source web", () => {
    expect(JSON.parse(buildActionMetadata("web"))).toEqual({ source: "web" });
  });

  it("merges extra telegram metadata and the source argument wins", () => {
    const parsed = JSON.parse(
      buildActionMetadata("telegram", {
        telegram_user_id: "123456",
        telegram_message_id: "789",
        source: "spoofed",
      }),
    );
    expect(parsed).toEqual({
      source: "telegram",
      telegram_user_id: "123456",
      telegram_message_id: "789",
    });
  });
});

describe("actorDisplayName", () => {
  it("joins first and last name", () => {
    expect(actorDisplayName({ first_name: "สมชาย", last_name: "รักษ์ดี" })).toBe("สมชาย รักษ์ดี");
  });

  it("trims when last name is empty", () => {
    expect(actorDisplayName({ first_name: "สมชาย", last_name: "" })).toBe("สมชาย");
  });
});

describe("nowMysqlUtcDateTime", () => {
  it("formats a Date as MySQL UTC", () => {
    expect(nowMysqlUtcDateTime(new Date(Date.UTC(2026, 5, 11, 9, 30, 5)))).toBe(
      "2026-06-11 09:30:05",
    );
  });

  it("defaults to now and matches the MySQL shape", () => {
    expect(nowMysqlUtcDateTime()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

const NOW = new Date(Date.UTC(2026, 5, 11, 9, 0, 0));
const NOW_SQL = "2026-06-11 09:00:00";

function makeMemo(overrides: Partial<WorkflowMemoRow> = {}): WorkflowMemoRow {
  return {
    id: 42,
    memo_no: "EM-2026-001",
    status: "pending",
    current_step: "Manager / Top Section",
    revision_no: 0,
    selected_route_json: JSON.stringify(FULL_ROUTE),
    deleted_at: null,
    ...overrides,
  };
}

function makeActor(overrides: Partial<WorkflowActorRow> = {}): WorkflowActorRow {
  return {
    id: 7,
    first_name: "สมชาย",
    last_name: "รักษ์ดี",
    roles: ["manager"],
    approval_level: "Manager / Top Section",
    status: "active",
    ...overrides,
  };
}

describe("evaluateApproveAction", () => {
  it("manager approves at Manager step → intermediate check, advances to GM", () => {
    const result = evaluateApproveAction({
      memo: makeMemo(),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toEqual({
      status: "pending",
      workflow_state: "Checked",
      current_step: "General Manager",
      updated_at: NOW_SQL,
    });
    expect(result.payload.workflowAction).toEqual({
      revision_no: 0,
      action_type: "check",
      step_label: "Manager / Top Section",
      actor_name: "สมชาย รักษ์ดี",
      result: "intermediate",
      reason: null,
      acted_at: NOW_SQL,
      metadata_json: JSON.stringify({ source: "web" }),
    });
  });

  it("manager cannot approve at GM step → 403", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ current_step: "General Manager" }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "You do not have permission for this step",
    });
  });

  it("GM approves GM step and advances to MD when route continues", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ current_step: "General Manager" }),
      actor: makeActor({
        id: 8,
        first_name: "ประเสริฐ",
        last_name: "สุขสวัสดิ์",
        roles: ["general-manager"],
        approval_level: "General Manager",
      }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.current_step).toBe("Managing Director");
    expect(result.payload.memoUpdate.status).toBe("pending");
  });

  it("MD approving final MD step marks memo approved", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ current_step: "Managing Director" }),
      actor: makeActor({
        id: 9,
        first_name: "วิชาญ",
        last_name: "ประสิทธิ์ชัย",
        roles: ["managing-director"],
        approval_level: "Managing Director",
      }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toEqual({
      status: "approved",
      workflow_state: "Approved",
      current_step: "Managing Director",
      updated_at: NOW_SQL,
    });
    expect(result.payload.workflowAction.action_type).toBe("approve");
    expect(result.payload.workflowAction.result).toBe("final");
  });

  it("approve is blocked when pending read actions exist", () => {
    const result = evaluateApproveAction({
      memo: makeMemo(),
      actor: makeActor(),
      pendingReadCount: 2,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 409,
      message: "Pending read acknowledgements remain",
    });
  });

  it("rejects inactive actor", () => {
    const result = evaluateApproveAction({
      memo: makeMemo(),
      actor: makeActor({ status: "suspended" }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 403, message: "User account is not active" });
  });

  it("rejects non-pending memo", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ status: "approved" }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "Memo is not pending" });
  });

  it("rejects voided memo", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ deleted_at: "2026-06-10 08:00:00" }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "Memo has been voided" });
  });

  it("errors with 422 when route is missing", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ selected_route_json: null }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
  });

  it("actor_name is derived from the DB user row, never from a request body", () => {
    const result = evaluateApproveAction({
      memo: makeMemo(),
      actor: makeActor({ first_name: "ปุณณวิช", last_name: "ภูประเสริฐ", roles: ["admin"] }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.workflowAction.actor_name).toBe("ปุณณวิช ภูประเสริฐ");
  });

  it("metadata_json merges telegram metadata with source", () => {
    const result = evaluateApproveAction({
      memo: makeMemo(),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "telegram",
      metadata: { telegram_user_id: "123" },
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.payload.workflowAction.metadata_json)).toEqual({
      source: "telegram",
      telegram_user_id: "123",
    });
  });
});

describe("evaluateReturnAction", () => {
  it("authorized approver returns memo with reason", () => {
    const result = evaluateReturnAction({
      memo: makeMemo(),
      actor: makeActor(),
      reason: "ข้อมูลงบประมาณไม่ครบ",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toEqual({
      status: "returned",
      return_reason: "ข้อมูลงบประมาณไม่ครบ",
      updated_at: NOW_SQL,
    });
    expect(result.payload.workflowAction).toEqual({
      revision_no: 0,
      action_type: "return_for_revision",
      step_label: "Manager / Top Section",
      actor_name: "สมชาย รักษ์ดี",
      result: null,
      reason: "ข้อมูลงบประมาณไม่ครบ",
      acted_at: NOW_SQL,
      metadata_json: JSON.stringify({ source: "web" }),
    });
  });

  it("requires an authorized approver (manager cannot return at GM step)", () => {
    const result = evaluateReturnAction({
      memo: makeMemo({ current_step: "General Manager" }),
      actor: makeActor(),
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("requires a non-empty reason", () => {
    const result = evaluateReturnAction({
      memo: makeMemo(),
      actor: makeActor(),
      reason: "   ",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 400, message: "returnReason is required" });
  });

  it("rejects voided memo", () => {
    const result = evaluateReturnAction({
      memo: makeMemo({ deleted_at: "2026-06-10 08:00:00" }),
      actor: makeActor(),
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "Memo has been voided" });
  });

  it("rejects non-pending memo", () => {
    const result = evaluateReturnAction({
      memo: makeMemo({ status: "approved" }),
      actor: makeActor(),
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "Memo is not pending" });
  });
});

describe("evaluateRejectAction", () => {
  it("authorized approver rejects with disposition and reason", () => {
    const result = evaluateRejectAction({
      memo: makeMemo(),
      actor: makeActor(),
      disposition: "revision-allowed",
      reason: "ราคาสูงเกินงบ",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toEqual({
      status: "rejected",
      reject_disposition: "revision-allowed",
      reject_reason: "ราคาสูงเกินงบ",
      updated_at: NOW_SQL,
    });
    expect(result.payload.workflowAction.action_type).toBe("reject");
    expect(result.payload.workflowAction.result).toBe("revision-allowed");
    expect(result.payload.workflowAction.reason).toBe("ราคาสูงเกินงบ");
  });

  it("requires an authorized active approver", () => {
    const inactive = evaluateRejectAction({
      memo: makeMemo(),
      actor: makeActor({ status: "pending" }),
      disposition: "close",
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(inactive.ok).toBe(false);
    if (inactive.ok) return;
    expect(inactive.status).toBe(403);
  });

  it("requires a non-empty reason", () => {
    const result = evaluateRejectAction({
      memo: makeMemo(),
      actor: makeActor(),
      disposition: "close",
      reason: "",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 400, message: "rejectReason is required" });
  });

  it("rejects voided memo", () => {
    const result = evaluateRejectAction({
      memo: makeMemo({ deleted_at: "2026-06-10 08:00:00" }),
      actor: makeActor(),
      disposition: "close",
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "Memo has been voided" });
  });

  it("rejects non-pending memo", () => {
    const result = evaluateRejectAction({
      memo: makeMemo({ status: "returned" }),
      actor: makeActor(),
      disposition: "close",
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "Memo is not pending" });
  });
});
