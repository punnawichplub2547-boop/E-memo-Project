import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { mapSignatureRows, loadMemoForExport } from "./load-memo-export";
import type { WorkflowActionDbRow } from "@/lib/db-memos";

function row(partial: Partial<WorkflowActionDbRow>): WorkflowActionDbRow {
  return {
    revision_no: 0,
    action_type: "approve",
    step_label: null,
    actor_name: null,
    result: null,
    reason: null,
    acted_at: "2026-06-01 10:00:00",
    metadata_json: null,
    ...partial,
  };
}

describe("mapSignatureRows", () => {
  it("keeps only the three approval signature levels", () => {
    const rows = [
      row({ step_label: "Manager / Top Section", actor_name: "A", acted_at: "2026-06-01 10:00:00" }),
      row({ step_label: "Read", actor_name: "X" }),
      row({ step_label: "General Manager", actor_name: "B", acted_at: "2026-06-02 10:00:00" }),
      row({ step_label: "Managing Director", actor_name: "C", acted_at: "2026-06-03 10:00:00" }),
    ];
    expect(mapSignatureRows(rows)).toEqual([
      { stepLabel: "Manager / Top Section", actorName: "A", actedAt: "2026-06-01 10:00:00" },
      { stepLabel: "General Manager", actorName: "B", actedAt: "2026-06-02 10:00:00" },
      { stepLabel: "Managing Director", actorName: "C", actedAt: "2026-06-03 10:00:00" },
    ]);
  });

  it("defaults a missing actor name to '-' and serializes a Date acted_at", () => {
    const d = new Date("2026-06-01T10:00:00Z");
    expect(mapSignatureRows([row({ step_label: "General Manager", actor_name: null, acted_at: d })])).toEqual([
      { stepLabel: "General Manager", actorName: "-", actedAt: d.toISOString() },
    ]);
  });
});

describe("loadMemoForExport", () => {
  it("returns null when the memo does not exist", async () => {
    const pool = { query: vi.fn().mockResolvedValueOnce([[], undefined]) } as unknown as Pool;
    expect(await loadMemoForExport("EM-NOPE", pool)).toBeNull();
  });
});
