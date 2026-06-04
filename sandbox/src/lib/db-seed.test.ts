import { describe, expect, it } from "vitest";
import { seedMemos } from "./approval";
import { buildSeedWorkflowAction, memoToDbSeedRow, toMysqlUtcDateTime } from "./db-seed";

describe("DB seed helpers", () => {
  it("converts Bangkok display timestamps to UTC MySQL DATETIME strings", () => {
    expect(toMysqlUtcDateTime("17 May 2026 17:00")).toBe("2026-05-17 10:00:00");
    expect(toMysqlUtcDateTime("18 May 2026 09:20")).toBe("2026-05-18 02:20:00");
  });

  it("maps MemoRecord.id to memo_no and keeps the internal DB id out of the seed row", () => {
    const row = memoToDbSeedRow(seedMemos[0]);

    expect(row.memo_no).toBe("EM-2026-001");
    expect(row).not.toHaveProperty("id");
  });

  it("converts scalar fields and inferred workflow state for a seed memo", () => {
    const pending = memoToDbSeedRow(seedMemos[0]);
    const approved = memoToDbSeedRow(seedMemos[2]);
    const rejected = memoToDbSeedRow(seedMemos[5]);

    expect(pending.workflow_state).toBe("Issued");
    expect(approved.workflow_state).toBe("Approved");
    expect(rejected.workflow_state).toBe("Rejected");
    expect(pending.created_at).toBe("2026-05-17 10:00:00");
    expect(pending.updated_at).toBe("2026-05-18 02:20:00");
    expect(pending.cycle_hours).toBe(12);
  });

  it("uses null for absent JSON fields so legacy seed rows match DB-1 expectations", () => {
    const row = memoToDbSeedRow(seedMemos[0]);

    expect(row.request_items_json).toBeNull();
    expect(row.price_comparisons_json).toBeNull();
    expect(row.selected_route_json).toBeNull();
    expect(row.read_recipients_json).toBeNull();
  });

  it("builds one submit workflow action per seed memo", () => {
    const row = memoToDbSeedRow(seedMemos[0]);
    const action = buildSeedWorkflowAction(row);

    expect(action.action_type).toBe("submit");
    expect(action.revision_no).toBe(0);
    expect(action.acted_at).toBe(row.created_at);
    expect(action.actor_name).toBe(seedMemos[0].requester);
    expect(action.step_label).toBeNull();
  });
});
