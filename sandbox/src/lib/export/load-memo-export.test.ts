import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { mapSignatureRows, loadMemoForExport } from "./load-memo-export";
import type { WorkflowActionDbRow } from "@/lib/db-memos";
import type { MemoRecord } from "@/lib/approval";
import { buildCustomRoute } from "@/lib/custom-route";
import { buildMemoExcelWorkbook } from "./memo-excel";

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

// Regression (B1): a custom route writes workflow_step_actions.step_label as the raw
// person token ("person:1#42") — that is what workflow-rules.ts persists. Filtering the
// rows down to the three Book1 levels dropped every custom signature, so an approved
// custom-route memo exported an Excel sheet whose signature block was blank forever.
// These tests deliberately start from DB-shaped rows (not hand-built MemoSignature
// objects) because hand-built fixtures are exactly what hid the bug.
describe("mapSignatureRows — custom route tokens", () => {
  const approvers = buildCustomRoute([
    { userId: 42, name: "สมชาย ใจดี", approvalLevel: "Manager / Top Section", department: "IT" },
    { userId: 43, name: "วิชัย โรจน์ดี", approvalLevel: "General Manager", department: "IT" },
  ]).approvers;

  it("keeps person-token step labels", () => {
    const rows = [
      row({ step_label: approvers[0].stepKey, actor_name: "สมชาย ใจดี", acted_at: "2026-06-01 10:00:00" }),
      row({ step_label: approvers[1].stepKey, actor_name: "วิชัย โรจน์ดี", acted_at: "2026-06-02 10:00:00" }),
      row({ step_label: "Read", actor_name: "X" }),
    ];
    expect(mapSignatureRows(rows)).toEqual([
      { stepLabel: approvers[0].stepKey, actorName: "สมชาย ใจดี", actedAt: "2026-06-01 10:00:00" },
      { stepLabel: approvers[1].stepKey, actorName: "วิชัย โรจน์ดี", actedAt: "2026-06-02 10:00:00" },
    ]);
  });

  it("prints the signed names into the Excel signature block", async () => {
    const memo: MemoRecord = {
      id: "EM-2026-100",
      title: "ขออนุมัติซื้อวัตถุดิบ",
      requester: "สมหญิง มีสุข",
      department: "IT",
      category: "general-purchase",
      amount: 15000,
      status: "approved",
      currentStep: approvers[1].stepKey,
      cycleHours: 0,
      createdAt: "01 Jan 2026 09:00",
      updatedAt: "03 Jan 2026 09:00",
      selectedRoute: approvers.map((a) => a.stepKey),
      customRoute: approvers,
    };
    const signatures = mapSignatureRows([
      row({ step_label: approvers[0].stepKey, actor_name: "สมชาย ใจดี", acted_at: "02 Jan 2026 10:00" }),
      row({ step_label: approvers[1].stepKey, actor_name: "วิชัย โรจน์ดี", acted_at: "03 Jan 2026 09:00" }),
    ]);
    const wb = await buildMemoExcelWorkbook(memo, signatures);
    const parts: string[] = [];
    wb.getWorksheet("Memo")!.eachRow((r) => r.eachCell((cell) => parts.push(String(cell.value ?? ""))));
    const text = parts.join("\n");
    expect(text).toContain("(สมชาย ใจดี)");
    expect(text).toContain("(วิชัย โรจน์ดี)");
    expect(text).not.toContain("(...ชื่อ-สกุล...)");
    expect(text).not.toContain("Date: ____________");
  });
});

describe("loadMemoForExport", () => {
  it("returns null when the memo does not exist", async () => {
    const pool = { query: vi.fn().mockResolvedValueOnce([[], undefined]) } as unknown as Pool;
    expect(await loadMemoForExport("EM-NOPE", pool)).toBeNull();
  });
});
