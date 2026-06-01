import { describe, expect, it } from "vitest";
import { serializeMemoRecord, toBangkokDisplayTimestamp } from "./db-memos";

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
});
