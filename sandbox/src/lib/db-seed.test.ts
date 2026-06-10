import { describe, expect, it } from "vitest";
import { seedMemos } from "./approval";
import { assertSeedAllowed, buildSeedWorkflowAction, memoToDbSeedRow, toMysqlUtcDateTime } from "./db-seed";

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
    const pending = memoToDbSeedRow(seedMemos[0]);   // EM-2026-001 pending
    const approved = memoToDbSeedRow(seedMemos[3]);  // EM-2026-004 approved
    const rejected = memoToDbSeedRow(seedMemos[7]);  // EM-2026-008 rejected

    expect(pending.workflow_state).toBe("Issued");
    expect(approved.workflow_state).toBe("Approved");
    expect(rejected.workflow_state).toBe("Rejected");
    expect(pending.created_at).toBe("2026-06-09 02:15:00");
    expect(pending.updated_at).toBe("2026-06-09 02:15:00");
    expect(pending.cycle_hours).toBe(4);
  });

  it("uses null for absent JSON fields so legacy seed rows match DB-1 expectations", () => {
    // Use a minimal fixture — EM-2026-001 now includes selectedRoute for demo quality.
    const row = memoToDbSeedRow({
      ...seedMemos[0],
      selectedRoute: undefined,
      recommendedRoute: undefined,
      readRecipients: undefined,
      attachments: undefined,
      requestItems: undefined,
      priceComparisons: undefined,
    });

    expect(row.request_items_json).toBeNull();
    expect(row.price_comparisons_json).toBeNull();
    expect(row.selected_route_json).toBeNull();
    expect(row.read_recipients_json).toBeNull();
    expect(row.attachments_json).toBeNull();
  });

  it("serializes attachment metadata to JSON when present", () => {
    const row = memoToDbSeedRow({
      ...seedMemos[0],
      attachments: [{
        id: "att-1",
        originalName: "quote.pdf",
        storedName: "att-1-quote.pdf",
        size: 1024,
        mimeType: "application/pdf",
        uploadedAt: "05 Jun 2026 17:30",
      }],
    });

    expect(row.attachments_json).toContain("quote.pdf");
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

  it("allows seeding the default local MySQL URL without an explicit confirmation", () => {
    expect(() =>
      assertSeedAllowed("mysql://hr_ememo:password@127.0.0.1:3307/hr_ememo", undefined)
    ).not.toThrow();
  });

  it("blocks seeding a non-local MySQL URL unless explicitly confirmed", () => {
    expect(() =>
      assertSeedAllowed("mysql://hr_ememo:password@hr-ememo-db:3306/hr_ememo", undefined)
    ).toThrow(/Refusing to seed non-local database/);
  });

  it("allows seeding a non-local MySQL URL when explicitly confirmed", () => {
    expect(() =>
      assertSeedAllowed("mysql://hr_ememo:password@hr-ememo-db:3306/hr_ememo", "YES")
    ).not.toThrow();
  });
});
