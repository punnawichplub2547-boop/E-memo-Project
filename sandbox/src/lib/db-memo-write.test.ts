import { describe, expect, it } from "vitest";
import type { MemoRecord, ReadAction } from "./approval";
import {
  buildMemoWritePayload,
  buildNewMemoReadActionRows,
  buildNewMemoWorkflowAction,
} from "./db-memo-write";

describe("DB memo write helpers", () => {
  const readActions: ReadAction[] = [
    { recipient: "ACC/FIN", status: "pending" },
    { recipient: "HR&GA", status: "read", actedAt: "01 Jun 2026 10:05" },
  ];

  const memo: MemoRecord = {
    id: "EM-20260601-143022-4F7",
    title: "New memo",
    requester: "อำภา หิงคำ",
    department: "HR&GA",
    category: "general-purchase",
    amount: 12000,
    status: "pending",
    currentStep: "Manager / Top Section",
    workflowState: "Issued",
    cycleHours: 0,
    createdAt: "01 Jun 2026 14:30",
    updatedAt: "01 Jun 2026 14:30",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    readRecipients: ["ACC/FIN", "HR&GA"],
    readActions,
  };

  it("builds memo row params using memo_no and UTC timestamps", () => {
    const payload = buildMemoWritePayload(memo);

    expect(payload.row.memo_no).toBe("EM-20260601-143022-4F7");
    expect(payload.row.created_at).toBe("2026-06-01 07:30:00");
    expect(payload.row.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.row.selected_route_json).toBe(JSON.stringify(["Manager / Top Section", "General Manager"]));
  });

  it("builds submit workflow action for pending memos", () => {
    const action = buildNewMemoWorkflowAction(buildMemoWritePayload(memo).row);

    expect(action.action_type).toBe("submit");
    expect(action.revision_no).toBe(0);
    expect(action.acted_at).toBe("2026-06-01 07:30:00");
    expect(action.step_label).toBeNull();
  });

  it("builds save_draft workflow action for draft memos", () => {
    const draft: MemoRecord = { ...memo, status: "draft" };
    const action = buildNewMemoWorkflowAction(buildMemoWritePayload(draft).row);

    expect(action.action_type).toBe("save_draft");
  });

  it("builds read action rows for the memo current revision", () => {
    const rows = buildNewMemoReadActionRows(memo);

    expect(rows).toEqual([
      { revision_no: 0, recipient_name: "ACC/FIN", status: "pending", acted_at: null, skip_reason: null, created_at: "2026-06-01 07:30:00", updated_at: "2026-06-01 07:30:00" },
      { revision_no: 0, recipient_name: "HR&GA", status: "read", acted_at: "2026-06-01 03:05:00", skip_reason: null, created_at: "2026-06-01 07:30:00", updated_at: "2026-06-01 07:30:00" },
    ]);
  });

  it("does not build read action rows when no readActions exist", () => {
    expect(buildNewMemoReadActionRows({ ...memo, readActions: undefined })).toEqual([]);
  });
});
