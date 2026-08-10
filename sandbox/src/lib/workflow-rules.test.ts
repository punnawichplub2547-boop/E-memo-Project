import { describe, expect, it } from "vitest";
import {
  actorDisplayName,
  buildActionMetadata,
  calculateNextStep,
  canActOnStep,
  evaluateApproveAction,
  evaluateRejectAction,
  evaluateReturnAction,
  evaluateReviewAction,
  nowMysqlUtcDateTime,
  parseRouteJson,
  type WorkflowActorRow,
  type WorkflowMemoRow,
} from "./workflow-rules";

const FULL_ROUTE = ["Manager / Top Section", "General Manager", "Managing Director"];

describe("canActOnStep", () => {
  it("manager can act at Manager / Top Section step for their own department's memo", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["manager"], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("manager cannot act at General Manager step", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["manager"], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "General Manager", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  it("manager CANNOT act on another department's memo at Manager / Top Section step", () => {
    // Visibility already scopes Manager/Top Section to their own department
    // (memo-visibility.ts); action permission must match, or a Manager could
    // approve/return/reject a memo they can't even see in their queue.
    expect(
      canActOnStep(
        { id: 1, roles: ["manager"], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "Manager / Top Section", department_name: "QA", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  it("GM can act at General Manager step regardless of department", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["general-manager"], approval_level: "General Manager", department: "IT" },
        { current_step: "General Manager", department_name: "QA", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("MD can act at Managing Director step regardless of department", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["managing-director"], approval_level: "Managing Director", department: "IT" },
        { current_step: "Managing Director", department_name: "QA", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("admin can act at any step regardless of department", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["admin", "requester"], approval_level: null, department: "IT" },
        { current_step: "Managing Director", department_name: "QA", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("null approval_level without admin role grants nothing", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["requester"], approval_level: null, department: "IT" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  it("HR&GA-style user with no admin role and no approval_level cannot act (department is never checked)", () => {
    // canActOnStep deliberately has no department-based grant path — department name
    // alone must never grant workflow power (CLAUDE.md role/visibility decision).
    // Department is only ever used to RESTRICT the Manager tier, never to grant.
    expect(
      canActOnStep(
        { id: 1, roles: ["requester", "read-recipient"], approval_level: null, department: "HR&GA" },
        { current_step: "General Manager", department_name: "HR&GA", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  // Self-approval gap (found in code review 2026-07-06): a requester whose own
  // approval_level happens to match their own memo's current_step (e.g. a
  // department Manager submitting their own memo — every route's mandatory
  // first step) must never be allowed to act on it themselves.
  it("blocks the requester from acting on their own memo even when approval_level matches the step (Manager / Top Section)", () => {
    expect(
      canActOnStep(
        { id: 5, roles: ["manager"], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: 5 },
      ),
    ).toBe(false);
  });

  it("blocks the requester from acting on their own memo at a company-wide level (General Manager)", () => {
    expect(
      canActOnStep(
        { id: 5, roles: ["general-manager"], approval_level: "General Manager", department: "IT" },
        { current_step: "General Manager", department_name: "QA", requester_user_id: 5 },
      ),
    ).toBe(false);
  });

  it("admin bypass still overrides the self-action block (admin can act on their own memo)", () => {
    expect(
      canActOnStep(
        { id: 5, roles: ["admin"], approval_level: null, department: "IT" },
        { current_step: "Managing Director", department_name: "QA", requester_user_id: 5 },
      ),
    ).toBe(true);
  });

  it("does not block when requester_user_id is null (legacy/seed memo with no FK — never treat as self)", () => {
    expect(
      canActOnStep(
        { id: 5, roles: ["manager"], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: null },
      ),
    ).toBe(true);
  });

  it("does not block a different actor from acting on someone else's memo", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["manager"], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: 5 },
      ),
    ).toBe(true);
  });
});

describe("canActOnStep — Supervisor (department-scoped, like Manager)", () => {
  it("supervisor can act at Supervisor step for their own department's memo", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["supervisor"], approval_level: "Supervisor", department: "HR&GA" },
        { current_step: "Supervisor", department_name: "HR&GA", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("supervisor CANNOT act on another department's memo at the Supervisor step", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["supervisor"], approval_level: "Supervisor", department: "HR&GA" },
        { current_step: "Supervisor", department_name: "QA", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  it("supervisor cannot act at the Manager / Top Section step", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["supervisor"], approval_level: "Supervisor", department: "HR&GA" },
        { current_step: "Manager / Top Section", department_name: "HR&GA", requester_user_id: 99 },
      ),
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
    department_name: "IT",
    requester_user_id: 99,
    requires_md_review: false,
    md_review_status: null,
    md_review_resume_step: null,
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
    department: "IT",
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
      md_review_status: null,
      md_review_resume_step: null,
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
      message: "คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้",
    });
  });

  it("manager from a different department cannot approve → 403 (matches visibility scoping)", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ department_name: "QA" }),
      actor: makeActor({ department: "IT" }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้",
    });
  });

  it("Manager check on a requires_md_review memo parks current_step at MD for review instead of advancing normally", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ requires_md_review: true, md_review_status: null }),
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
      current_step: "Managing Director",
      updated_at: NOW_SQL,
      md_review_status: "pending",
      md_review_resume_step: "General Manager",
    });
  });

  it("Manager check on a requires_md_review memo whose route ends at Manager stashes resume step as Managing Director (merge case)", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({
        selected_route_json: JSON.stringify(["Manager / Top Section"]),
        requires_md_review: true,
        md_review_status: null,
      }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.current_step).toBe("Managing Director");
    expect(result.payload.memoUpdate.status).toBe("pending");
    expect(result.payload.memoUpdate.md_review_status).toBe("pending");
    expect(result.payload.memoUpdate.md_review_resume_step).toBe("Managing Director");
  });

  it("does not re-stash once review is already completed (GM's own approve after review clears proceeds normally)", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({
        current_step: "General Manager",
        requires_md_review: true,
        md_review_status: "completed",
      }),
      actor: makeActor({
        id: 8,
        first_name: "ประเสริฐ",
        last_name: "สุขสวัสดิ์",
        roles: ["general-manager"],
        approval_level: "General Manager",
        department: "IT",
      }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.current_step).toBe("Managing Director");
    expect(result.payload.memoUpdate.md_review_status).toBeNull();
  });

  it("blocks approve when md_review_status is pending, even for the Managing Director actor", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({
        current_step: "Managing Director",
        requires_md_review: true,
        md_review_status: "pending",
      }),
      actor: makeActor({
        id: 9,
        first_name: "วิชาญ",
        last_name: "ประสิทธิ์ชัย",
        roles: ["managing-director"],
        approval_level: "Managing Director",
        department: "IT",
      }),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 409,
      message: "รอการพิจารณาของ MD ก่อน",
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
      md_review_status: null,
      md_review_resume_step: null,
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
      message: "ยังมีผู้รับทราบที่ยังไม่ได้กดรับทราบ",
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
    expect(result).toEqual({ ok: false, status: 403, message: "บัญชีผู้ใช้ไม่ได้ใช้งานอยู่" });
  });

  it("rejects non-pending memo", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ status: "approved" }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ไม่ได้อยู่ในสถานะรอดำเนินการ" });
  });

  it("rejects voided memo", () => {
    const result = evaluateApproveAction({
      memo: makeMemo({ deleted_at: "2026-06-10 08:00:00" }),
      actor: makeActor(),
      pendingReadCount: 0,
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ถูกยกเลิกแล้ว" });
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
      return_to_step: null,
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
    expect(result).toEqual({ ok: false, status: 400, message: "ต้องระบุเหตุผลในการส่งคืน" });
  });

  it("rejects voided memo", () => {
    const result = evaluateReturnAction({
      memo: makeMemo({ deleted_at: "2026-06-10 08:00:00" }),
      actor: makeActor(),
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ถูกยกเลิกแล้ว" });
  });

  it("rejects non-pending memo", () => {
    const result = evaluateReturnAction({
      memo: makeMemo({ status: "approved" }),
      actor: makeActor(),
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ไม่ได้อยู่ในสถานะรอดำเนินการ" });
  });
});

describe("evaluateReturnAction — selectable return destination (return_to_step)", () => {
  const ROUTE = ["Manager / Top Section", "General Manager", "Managing Director"];
  // GM acts on a memo currently at the GM step.
  const gmActor = makeActor({ approval_level: "General Manager", roles: ["general-manager"] });

  function returnAt(returnToStep: string | undefined, memoOverrides = {}) {
    return evaluateReturnAction({
      memo: makeMemo({
        current_step: "General Manager",
        selected_route_json: JSON.stringify(ROUTE),
        ...memoOverrides,
      }),
      actor: gmActor,
      reason: "ขอให้ทบทวน",
      returnToStep,
      source: "web",
      now: NOW,
    });
  }

  it("keeps a valid earlier step (index ≤ current step)", () => {
    const result = returnAt("Manager / Top Section");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBe("Manager / Top Section");
  });

  it("allows returning to the current step itself", () => {
    const result = returnAt("General Manager");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBe("General Manager");
  });

  it("coerces a non-member step to null", () => {
    const result = returnAt("Supervisor");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBeNull();
  });

  it("coerces a forward step (ahead of current) to null (Q2 — no forward selection)", () => {
    const result = returnAt("Managing Director");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBeNull();
  });

  it("defaults to null when returnToStep is not supplied", () => {
    const result = returnAt(undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBeNull();
  });

  // Admin actor so the guard passes on an MD-step memo — isolates the Q1 md cap
  // from the actor-permission check.
  const adminReturnAt = (returnToStep: string) =>
    evaluateReturnAction({
      memo: makeMemo({
        current_step: "Managing Director",
        selected_route_json: JSON.stringify(ROUTE),
        requires_md_review: true,
      }),
      actor: makeActor({ roles: ["admin"], approval_level: null }),
      reason: "ทบทวน",
      returnToStep,
      source: "web",
      now: NOW,
    });

  it("Q1: caps an md-review memo to Manager — a GM destination is coerced to null", () => {
    const result = adminReturnAt("General Manager");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBeNull();
  });

  it("Q1: an md-review memo still allows returning to Manager / Top Section", () => {
    const result = adminReturnAt("Manager / Top Section");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBe("Manager / Top Section");
  });

  it("honors a Supervisor destination on a supervised route", () => {
    const result = evaluateReturnAction({
      memo: makeMemo({
        current_step: "General Manager",
        selected_route_json: JSON.stringify(["Supervisor", "Manager / Top Section", "General Manager"]),
      }),
      actor: gmActor,
      reason: "ส่งกลับให้ Supervisor ตรวจ",
      returnToStep: "Supervisor",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate.return_to_step).toBe("Supervisor");
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
    expect(result).toEqual({ ok: false, status: 400, message: "ต้องระบุเหตุผลในการปฏิเสธ" });
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
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ถูกยกเลิกแล้ว" });
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
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ไม่ได้อยู่ในสถานะรอดำเนินการ" });
  });

  it("blocks a Supervisor from rejecting (check-only step), even at their own valid step", () => {
    const result = evaluateRejectAction({
      memo: makeMemo({ current_step: "Supervisor", department_name: "HR&GA" }),
      actor: makeActor({ roles: ["supervisor"], approval_level: "Supervisor", department: "HR&GA" }),
      disposition: "close",
      reason: "ราคาสูงเกินไป",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 403, message: "Supervisor ไม่มีสิทธิ์ปฏิเสธเมโม" });
  });

  it("still lets an admin who happens to carry a Supervisor approval_level reject", () => {
    const result = evaluateRejectAction({
      memo: makeMemo({ current_step: "Supervisor", department_name: "HR&GA" }),
      actor: makeActor({ roles: ["admin"], approval_level: "Supervisor", department: "HR&GA" }),
      disposition: "close",
      reason: "ปิดคำขอ",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });
});

describe("calculateNextStep — Supervisor prefix", () => {
  it("advances from Supervisor to Manager / Top Section", () => {
    const result = calculateNextStep(
      JSON.stringify(["Supervisor", "Manager / Top Section", "General Manager"]),
      "Supervisor",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isFinal).toBe(false);
    expect(result.nextCurrentStep).toBe("Manager / Top Section");
  });
});

describe("evaluateReviewAction", () => {
  const reviewMemo = (overrides: Partial<WorkflowMemoRow> = {}) =>
    makeMemo({
      current_step: "Managing Director",
      requires_md_review: true,
      md_review_status: "pending",
      md_review_resume_step: "General Manager",
      ...overrides,
    });

  const mdActor = (overrides: Partial<WorkflowActorRow> = {}) =>
    makeActor({
      id: 9,
      first_name: "วิชาญ",
      last_name: "ประสิทธิ์ชัย",
      roles: ["managing-director"],
      approval_level: "Managing Director",
      ...overrides,
    });

  it("rejects a voided memo even when md_review_status is pending and actor is MD", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo({ deleted_at: "2026-06-15 10:00:00" }),
      actor: mdActor(),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, status: 409, message: "เมโมนี้ถูกยกเลิกแล้ว" });
  });

  it("rejects when md_review_status is not pending", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo({ md_review_status: "completed" }),
      actor: mdActor(),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 409,
      message: "เมโมนี้ไม่มีการรอพิจารณาจาก MD อยู่",
    });
  });

  it("rejects an actor who is not Managing Director tier (and not admin)", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo(),
      actor: makeActor({ roles: ["general-manager"], approval_level: "General Manager" }),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "มีเฉพาะ Managing Director เท่านั้นที่ดำเนินการกับการพิจารณานี้ได้",
    });
  });

  it("acknowledged_no_objection resumes at the stashed step and clears the review gate", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo(),
      actor: mdActor(),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toMatchObject({
      status: "pending",
      current_step: "General Manager",
      md_review_status: "completed",
    });
    expect(result.payload.workflowAction.action_type).toBe("review");
    expect(result.payload.workflowAction.result).toBe("acknowledged_no_objection");
  });

  it("comment resumes at the stashed step, stores the comment, and clears the review gate", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo(),
      actor: mdActor(),
      response: "comment",
      comment: "ราคาสมเหตุสมผลแล้ว",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toMatchObject({
      status: "pending",
      current_step: "General Manager",
      md_review_status: "completed",
      md_review_comment: "ราคาสมเหตุสมผลแล้ว",
    });
  });

  it("acknowledged_no_objection auto-finalizes when the resume step is Managing Director itself (merge rule)", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo({ md_review_resume_step: "Managing Director" }),
      actor: mdActor(),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toMatchObject({
      status: "approved",
      workflow_state: "Approved",
      current_step: "Managing Director",
      md_review_status: "completed",
    });
    expect(result.payload.workflowAction.action_type).toBe("review");
    expect(result.payload.workflowAction.result).toBe("acknowledged_no_objection");
  });

  it("request_revision requires a reason and returns the memo like a normal Return", () => {
    const missingReason = evaluateReviewAction({
      memo: reviewMemo(),
      actor: mdActor(),
      response: "request_revision",
      source: "web",
      now: NOW,
    });
    expect(missingReason).toEqual({
      ok: false,
      status: 400,
      message: "ต้องระบุเหตุผลเมื่อขอแก้ไข",
    });

    const result = evaluateReviewAction({
      memo: reviewMemo(),
      actor: mdActor(),
      response: "request_revision",
      reason: "กรุณาแนบใบเสนอราคาผู้ขายรายใหม่",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toMatchObject({
      status: "returned",
      return_reason: "กรุณาแนบใบเสนอราคาผู้ขายรายใหม่",
      md_review_status: "completed",
    });
    expect(result.payload.workflowAction.result).toBe("request_revision");
  });

  it("escalate_to_md_approval finalizes immediately, skipping the remaining route", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo(),
      actor: mdActor(),
      response: "escalate_to_md_approval",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.memoUpdate).toMatchObject({
      status: "approved",
      workflow_state: "Approved",
      current_step: "Managing Director",
      md_review_status: "escalated",
    });
    expect(result.payload.workflowAction.action_type).toBe("review");
    expect(result.payload.workflowAction.result).toBe("escalate_to_md_approval");
  });

  it("admin can act on the review like the Managing Director", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo(),
      actor: makeActor({ roles: ["admin"], approval_level: null }),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  // Self-review gap (found in code review 2026-07-07): the requester of a memo
  // that requires MD review must not be able to review/approve it themselves
  // just because they also hold the Managing Director approval_level.
  it("blocks the MD reviewer from acting on their own memo", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo({ requester_user_id: 9 }),
      actor: mdActor({ id: 9 }),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้",
    });
  });

  it("blocks self-review for every response type, not just acknowledged_no_objection", () => {
    const escalate = evaluateReviewAction({
      memo: reviewMemo({ requester_user_id: 9 }),
      actor: mdActor({ id: 9 }),
      response: "escalate_to_md_approval",
      source: "web",
      now: NOW,
    });
    expect(escalate.ok).toBe(false);

    const requestRevision = evaluateReviewAction({
      memo: reviewMemo({ requester_user_id: 9 }),
      actor: mdActor({ id: 9 }),
      response: "request_revision",
      reason: "เหตุผล",
      source: "web",
      now: NOW,
    });
    expect(requestRevision.ok).toBe(false);
  });

  it("admin bypass still overrides the self-review block", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo({ requester_user_id: 9 }),
      actor: makeActor({ id: 9, roles: ["admin"], approval_level: null }),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("does not block when requester_user_id is null (legacy/seed memo with no FK)", () => {
    const result = evaluateReviewAction({
      memo: reviewMemo({ requester_user_id: null }),
      actor: mdActor({ id: 9 }),
      response: "acknowledged_no_objection",
      source: "web",
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });
});

describe("canActOnStep - custom per-person route", () => {
  const actor = {
    id: 42,
    roles: ["requester"],
    approval_level: null,
    department: "IT",
  };

  it("lets the person named in the token act, whatever their approval_level", () => {
    expect(
      canActOnStep(actor, {
        current_step: "person:2#42",
        department_name: "PD",
        requester_user_id: 99,
      }),
    ).toBe(true);
  });

  it("blocks a different user even when their approval_level looks senior", () => {
    expect(
      canActOnStep(
        { id: 7, roles: [], approval_level: "Managing Director", department: "MD" },
        { current_step: "person:2#42", department_name: "PD", requester_user_id: 99 },
      ),
    ).toBe(false);
  });

  it("ignores department for custom steps (the person is picked by name, not by dept)", () => {
    expect(
      canActOnStep(
        { ...actor, department: "QA" },
        { current_step: "person:1#42", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("still refuses to let the requester act on their own custom step", () => {
    expect(
      canActOnStep(actor, {
        current_step: "person:1#42",
        department_name: "IT",
        requester_user_id: 42,
      }),
    ).toBe(false);
  });

  it("still lets admin act on a custom step", () => {
    expect(
      canActOnStep(
        { id: 1, roles: ["admin"], approval_level: null, department: "IT" },
        { current_step: "person:1#42", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(true);
  });

  it("leaves level-route behaviour untouched", () => {
    expect(
      canActOnStep(
        { id: 5, roles: [], approval_level: "Manager / Top Section", department: "IT" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(true);
    expect(
      canActOnStep(
        { id: 5, roles: [], approval_level: "Manager / Top Section", department: "PD" },
        { current_step: "Manager / Top Section", department_name: "IT", requester_user_id: 99 },
      ),
    ).toBe(false);
  });
});

describe("evaluateRejectAction - Q23 custom check steps cannot reject", () => {
  const route = ["person:1#42", "person:2#7", "person:3#9"];
  const baseMemo = {
    id: 1,
    memo_no: "EM-2026-100",
    status: "pending" as const,
    revision_no: 0,
    selected_route_json: JSON.stringify(route),
    deleted_at: null,
    department_name: "IT",
    requester_user_id: 99,
    requires_md_review: false,
    md_review_status: null,
    md_review_resume_step: null,
  };
  const activeActor = (id: number) => ({
    id,
    first_name: "ผู้",
    last_name: "อนุมัติ",
    roles: [] as string[],
    approval_level: null,
    department: "IT",
    status: "active" as const,
  });

  it("blocks a non-final custom approver with 403", () => {
    const result = evaluateRejectAction({
      memo: { ...baseMemo, current_step: "person:2#7" },
      actor: activeActor(7),
      disposition: "close",
      reason: "ไม่เหมาะสม",
      source: "web",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.message).toContain("ตรวจ/เห็นชอบ");
    }
  });

  it("allows the final custom approver to reject", () => {
    const result = evaluateRejectAction({
      memo: { ...baseMemo, current_step: "person:3#9" },
      actor: activeActor(9),
      disposition: "revision-allowed",
      reason: "ขอให้แก้ไข",
      source: "web",
    });
    expect(result.ok).toBe(true);
  });

  it("allows a single-person custom route to reject", () => {
    const result = evaluateRejectAction({
      memo: {
        ...baseMemo,
        selected_route_json: JSON.stringify(["person:1#42"]),
        current_step: "person:1#42",
      },
      actor: activeActor(42),
      disposition: "close",
      reason: "ไม่อนุมัติ",
      source: "web",
    });
    expect(result.ok).toBe(true);
  });

  it("still lets admin reject from a non-final custom step", () => {
    const result = evaluateRejectAction({
      memo: { ...baseMemo, current_step: "person:2#7" },
      actor: { ...activeActor(1), roles: ["admin"] },
      disposition: "close",
      reason: "ยกเลิก",
      source: "web",
    });
    expect(result.ok).toBe(true);
  });

  it("leaves the Supervisor rule and normal level rejects untouched", () => {
    const levelMemo = {
      ...baseMemo,
      selected_route_json: JSON.stringify(["Supervisor", "Manager / Top Section"]),
      current_step: "Supervisor",
    };
    const supervisor = { ...activeActor(5), approval_level: "Supervisor" };
    const blocked = evaluateRejectAction({
      memo: levelMemo, actor: supervisor, disposition: "close", reason: "x", source: "web",
    });
    expect(blocked.ok).toBe(false);

    const manager = { ...activeActor(6), approval_level: "Manager / Top Section" };
    const allowed = evaluateRejectAction({
      memo: { ...levelMemo, current_step: "Manager / Top Section" },
      actor: manager, disposition: "close", reason: "x", source: "web",
    });
    expect(allowed.ok).toBe(true);
  });
});

describe("MD review gate - custom route (Q22)", () => {
  const route = ["person:1#42", "person:2#7", "person:3#9"];
  const memoBase = {
    id: 1,
    memo_no: "EM-2026-101",
    status: "pending" as const,
    revision_no: 0,
    selected_route_json: JSON.stringify(route),
    deleted_at: null,
    department_name: "IT",
    requester_user_id: 99,
    requires_md_review: true,
    md_review_status: null,
    md_review_resume_step: null,
  };
  const actor = (id: number) => ({
    id,
    first_name: "ก",
    last_name: "ข",
    roles: [] as string[],
    approval_level: null,
    department: "IT",
    status: "active" as const,
  });

  it("parks at Managing Director after the first custom step and stashes the next person", () => {
    const result = evaluateApproveAction({
      memo: { ...memoBase, current_step: "person:1#42" },
      actor: actor(42),
      pendingReadCount: 0,
      source: "web",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.memoUpdate.current_step).toBe("Managing Director");
      expect(result.payload.memoUpdate.md_review_status).toBe("pending");
      expect(result.payload.memoUpdate.md_review_resume_step).toBe("person:2#7");
      expect(result.payload.memoUpdate.status).toBe("pending");
    }
  });

  it("does NOT re-trigger the gate on later custom steps", () => {
    const result = evaluateApproveAction({
      memo: { ...memoBase, current_step: "person:2#7", md_review_status: "completed" },
      actor: actor(7),
      pendingReadCount: 0,
      source: "web",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.memoUpdate.current_step).toBe("person:3#9");
  });

  it("stashes Managing Director itself when the custom route has one person", () => {
    const result = evaluateApproveAction({
      memo: {
        ...memoBase,
        selected_route_json: JSON.stringify(["person:1#42"]),
        current_step: "person:1#42",
      },
      actor: actor(42),
      pendingReadCount: 0,
      source: "web",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.memoUpdate.md_review_resume_step).toBe("Managing Director");
  });

  it("still gates level routes at Manager / Top Section only", () => {
    const levelMemo = {
      ...memoBase,
      selected_route_json: JSON.stringify(["Supervisor", "Manager / Top Section", "General Manager"]),
      current_step: "Supervisor",
    };
    const supervisorPass = evaluateApproveAction({
      memo: levelMemo,
      actor: { ...actor(5), approval_level: "Supervisor" },
      pendingReadCount: 0,
      source: "web",
    });
    expect(supervisorPass.ok).toBe(true);
    if (supervisorPass.ok) {
      expect(supervisorPass.payload.memoUpdate.current_step).toBe("Manager / Top Section");
      expect(supervisorPass.payload.memoUpdate.md_review_status).toBeNull();
    }

    const managerPass = evaluateApproveAction({
      memo: { ...levelMemo, current_step: "Manager / Top Section" },
      actor: { ...actor(6), approval_level: "Manager / Top Section" },
      pendingReadCount: 0,
      source: "web",
    });
    expect(managerPass.ok).toBe(true);
    if (managerPass.ok) {
      expect(managerPass.payload.memoUpdate.current_step).toBe("Managing Director");
      expect(managerPass.payload.memoUpdate.md_review_status).toBe("pending");
      expect(managerPass.payload.memoUpdate.md_review_resume_step).toBe("General Manager");
    }
  });
});

describe("resolveReturnToStep - custom route", () => {
  const route = ["person:1#42", "person:2#7", "person:3#9"];
  const memo = (over: Record<string, unknown>) => ({
    id: 1,
    memo_no: "EM-2026-102",
    status: "pending" as const,
    revision_no: 0,
    selected_route_json: JSON.stringify(route),
    deleted_at: null,
    department_name: "IT",
    requester_user_id: 99,
    requires_md_review: false,
    md_review_status: null,
    md_review_resume_step: null,
    current_step: "person:3#9",
    ...over,
  });
  const actor = {
    id: 9,
    first_name: "ก",
    last_name: "ข",
    roles: [] as string[],
    approval_level: null,
    department: "IT",
    status: "active" as const,
  };

  it("accepts an earlier person as the return destination", () => {
    const r = evaluateReturnAction({
      memo: memo({}), actor, reason: "แก้ราคา", returnToStep: "person:2#7", source: "web",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.memoUpdate.return_to_step).toBe("person:2#7");
  });

  it("degrades a forward destination to null (restart from step 1)", () => {
    const r = evaluateReturnAction({
      memo: memo({ current_step: "person:1#42" }), actor: { ...actor, id: 42 },
      reason: "แก้", returnToStep: "person:3#9", source: "web",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.memoUpdate.return_to_step).toBeNull();
  });

  it("cannot resume past the MD-review gate (first person) when review is required", () => {
    const r = evaluateReturnAction({
      memo: memo({ requires_md_review: true }), actor,
      reason: "แก้", returnToStep: "person:2#7", source: "web",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.memoUpdate.return_to_step).toBeNull();
  });

  it("still allows returning to the first person when review is required", () => {
    const r = evaluateReturnAction({
      memo: memo({ requires_md_review: true }), actor,
      reason: "แก้", returnToStep: "person:1#42", source: "web",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.memoUpdate.return_to_step).toBe("person:1#42");
  });

  it("leaves the level-route MD gate anchored at Manager / Top Section", () => {
    const levelRoute = ["Manager / Top Section", "General Manager", "Managing Director"];
    const levelMemo = {
      ...memo({}),
      selected_route_json: JSON.stringify(levelRoute),
      current_step: "Managing Director",
      requires_md_review: true,
    };
    const gm = { ...actor, approval_level: "Managing Director" };
    const blocked = evaluateReturnAction({
      memo: levelMemo, actor: gm, reason: "แก้", returnToStep: "General Manager", source: "web",
    });
    expect(blocked.ok).toBe(true);
    if (blocked.ok) expect(blocked.payload.memoUpdate.return_to_step).toBeNull();

    const allowed = evaluateReturnAction({
      memo: levelMemo, actor: gm, reason: "แก้", returnToStep: "Manager / Top Section", source: "web",
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.payload.memoUpdate.return_to_step).toBe("Manager / Top Section");
  });
});
