import { describe, expect, it } from "vitest";
import { serializeMemoRecord, serializeWorkflowAction, toBangkokDisplayTimestamp, type WorkflowActionDbRow } from "./db-memos";

describe("DB memo serializer", () => {
  it("maps memo_no to MemoRecord.id instead of exposing the DB primary key", () => {
    const memo = serializeMemoRecord({
      id: 42,
      memo_no: "EM-20260601-143022-4F7",
      title: "Test memo",
      requester_name: "Requester",
      department_name: "HR&GA",
      category: "general-purchase",
      amount: "9200.00",
      budget_status: null,
      account_code: null,
      budget_plan: null,
      budget_used: null,
      description: null,
      status: "pending",
      workflow_state: "Issued",
      current_step: "Manager / Top Section",
      cycle_hours: null,
      recommended_final_approver: null,
      recommended_route_json: null,
      selected_route_json: null,
      route_mode: null,
      route_override_reason: null,
      notify_md: 0,
      is_price_adjustment: 0,
      follows_production_plan: 0,
      is_dead_stock: 0,
      dept_monthly_over_budget_total: null,
      return_reason: null,
      reject_reason: null,
      reject_disposition: null,
      revision_no: 0,
      revision_submitted_at: null,
      revision_note: null,
      price_comparisons_json: null,
      selected_vendor_id: null,
      selected_vendor_reason: null,
      price_adjustment_reason: null,
      request_items_json: null,
      read_recipients_json: null,
      created_at: new Date("2026-05-17T10:00:00.000Z"),
      updated_at: new Date("2026-05-18T02:20:00.000Z"),
    }, []);

    expect(memo.id).toBe("EM-20260601-143022-4F7");
    expect(memo).not.toHaveProperty("memo_no");
    expect(memo.createdAt).toBe("17 May 2026 17:00");
    expect(memo.updatedAt).toBe("18 May 2026 09:20");
    expect(memo.cycleHours).toBe(0);
  });

  it("decodes JSON columns and read action rows", () => {
    const memo = serializeMemoRecord({
      id: 1,
      memo_no: "EM-2026-READ",
      title: "Read memo",
      requester_name: "Requester",
      department_name: "HR&GA",
      category: "service-contract",
      amount: 18000,
      budget_status: "in-budget",
      account_code: "GA-OPS",
      budget_plan: "150000.00",
      budget_used: "68000.00",
      description: "Description",
      status: "pending",
      workflow_state: "Issued",
      current_step: "General Manager",
      cycle_hours: 18,
      recommended_final_approver: "General Manager",
      recommended_route_json: JSON.stringify(["Manager / Top Section", "General Manager"]),
      selected_route_json: ["Manager / Top Section", "General Manager"],
      route_mode: "recommended",
      route_override_reason: null,
      notify_md: 1,
      is_price_adjustment: 0,
      follows_production_plan: 0,
      is_dead_stock: 0,
      dept_monthly_over_budget_total: null,
      return_reason: null,
      reject_reason: null,
      reject_disposition: null,
      revision_no: 2,
      revision_submitted_at: new Date("2026-05-18T02:00:00.000Z"),
      revision_note: "Updated",
      price_comparisons_json: null,
      selected_vendor_id: null,
      selected_vendor_reason: null,
      price_adjustment_reason: null,
      request_items_json: JSON.stringify([{ id: "1", name: "Paper", unit: "pack", qty: 1, unitPrice: 100 }]),
      read_recipients_json: JSON.stringify(["ACC/FIN"]),
      created_at: "2026-05-14 12:00:00",
      updated_at: "2026-05-15 06:00:00",
    }, [
      { recipient_name: "ACC/FIN", status: "read", acted_at: new Date("2026-05-15T07:00:00.000Z"), skip_reason: null },
      { recipient_name: "HR&GA", status: "skipped", acted_at: null, skip_reason: "Prototype skip" },
    ]);

    expect(memo.amount).toBe(18000);
    expect(memo.budgetPlan).toBe(150000);
    expect(memo.notifyMD).toBe(true);
    expect(memo.revisionNo).toBe(2);
    expect(memo.revisionSubmittedAt).toBe("18 May 2026 09:00");
    expect(memo.recommendedRoute).toEqual(["Manager / Top Section", "General Manager"]);
    expect(memo.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
    expect(memo.requestItems).toEqual([{ id: "1", name: "Paper", unit: "pack", qty: 1, unitPrice: 100 }]);
    expect(memo.readRecipients).toEqual(["ACC/FIN"]);
    expect(memo.readActions).toEqual([
      { recipient: "ACC/FIN", status: "read", actedAt: "15 May 2026 14:00" },
      { recipient: "HR&GA", status: "skipped", skipReason: "Prototype skip" },
    ]);
  });

  it("formats UTC DATETIME values as Bangkok display timestamps", () => {
    expect(toBangkokDisplayTimestamp("2026-05-17 10:00:00")).toBe("17 May 2026 17:00");
  });

  it("decodes memo revision rows into MemoRecord.revisions", () => {
    const memo = serializeMemoRecord({
      id: 7,
      memo_no: "EM-2026-REV",
      title: "Current memo",
      requester_name: "Requester",
      department_name: "HR&GA",
      category: "general-purchase",
      amount: 15000,
      budget_status: null,
      account_code: null,
      budget_plan: null,
      budget_used: null,
      description: null,
      status: "pending",
      workflow_state: "Issued",
      current_step: "Manager / Top Section",
      cycle_hours: 0,
      recommended_final_approver: null,
      recommended_route_json: null,
      selected_route_json: null,
      route_mode: null,
      route_override_reason: null,
      notify_md: 0,
      is_price_adjustment: 0,
      follows_production_plan: 0,
      is_dead_stock: 0,
      dept_monthly_over_budget_total: null,
      return_reason: null,
      reject_reason: null,
      reject_disposition: null,
      revision_no: 1,
      revision_submitted_at: "2026-06-02 03:10:00",
      revision_note: "Quick resubmit",
      price_comparisons_json: null,
      selected_vendor_id: null,
      selected_vendor_reason: null,
      price_adjustment_reason: null,
      request_items_json: null,
      read_recipients_json: null,
      created_at: "2026-06-02 03:00:00",
      updated_at: "2026-06-02 03:10:00",
    }, [], [
      {
        revision_no: 0,
        source: "return",
        return_reason: "Please add quotation",
        reject_reason: null,
        revision_note: "Quick resubmit",
        submitted_at: "2026-06-02 03:00:00",
        snapshot_json: JSON.stringify({
          title: "Original memo",
          category: "general-purchase",
          department: "HR&GA",
          amount: 15000,
          selectedRoute: ["Manager / Top Section"],
          readRecipients: ["ACC/FIN"],
        }),
      },
    ]);

    expect(memo.revisions).toEqual([
      {
        revisionNo: 0,
        source: "return",
        returnReason: "Please add quotation",
        revisionNote: "Quick resubmit",
        submittedAt: "02 Jun 2026 10:00",
        snapshot: {
          title: "Original memo",
          category: "general-purchase",
          department: "HR&GA",
          amount: 15000,
          selectedRoute: ["Manager / Top Section"],
          readRecipients: ["ACC/FIN"],
        },
      },
    ]);
  });
});

describe("serializeWorkflowAction", () => {
  const baseRow: WorkflowActionDbRow = {
    revision_no: 0,
    action_type: "submit",
    step_label: null,
    actor_name: null,
    result: null,
    reason: null,
    acted_at: "2026-06-01 07:30:00",
    metadata_json: null,
  };

  it("converts acted_at UTC datetime string to Bangkok display format", () => {
    const action = serializeWorkflowAction("EM-001", baseRow);

    expect(action.actedAt).toBe("01 Jun 2026 14:30");
  });

  it("converts acted_at Date object to Bangkok display format", () => {
    const date = new Date("2026-06-01T07:30:00Z");
    const action = serializeWorkflowAction("EM-001", { ...baseRow, acted_at: date });

    expect(action.actedAt).toBe("01 Jun 2026 14:30");
  });

  it("passes memoNo through to the output field", () => {
    const action = serializeWorkflowAction("EM-20260601-143022-4F7", baseRow);

    expect(action.memoNo).toBe("EM-20260601-143022-4F7");
  });

  it("maps snake_case DB fields to camelCase output and preserves non-null string values", () => {
    const action = serializeWorkflowAction("EM-001", {
      ...baseRow,
      revision_no: 2,
      action_type: "approve",
      step_label: "General Manager",
      actor_name: "สมชาย ใจดี",
      result: "final",
      reason: "เอกสารครบถ้วน",
    });

    expect(action.revisionNo).toBe(2);
    expect(action.actionType).toBe("approve");
    expect(action.stepLabel).toBe("General Manager");
    expect(action.actorName).toBe("สมชาย ใจดี");
    expect(action.result).toBe("final");
    expect(action.reason).toBe("เอกสารครบถ้วน");
  });

  it("parses metadata_json string to a plain object in output.metadata", () => {
    const action = serializeWorkflowAction("EM-001", {
      ...baseRow,
      action_type: "read",
      metadata_json: JSON.stringify({ recipient: "ACC/FIN" }),
    });

    expect(action.metadata).toEqual({ recipient: "ACC/FIN" });
  });

  it("passes through already-parsed metadata_json object (mysql2 JSON column auto-parse case)", () => {
    const action = serializeWorkflowAction("EM-001", {
      ...baseRow,
      action_type: "skip_read",
      metadata_json: { recipients: ["ACC/FIN", "HR&GA"] },
    });

    expect(action.metadata).toEqual({ recipients: ["ACC/FIN", "HR&GA"] });
  });

  it("returns null for metadata and all optional string fields when DB row has nulls", () => {
    const action = serializeWorkflowAction("EM-001", baseRow);

    expect(action.metadata).toBeNull();
    expect(action.stepLabel).toBeNull();
    expect(action.actorName).toBeNull();
    expect(action.result).toBeNull();
    expect(action.reason).toBeNull();
  });
});
