import { describe, expect, it } from "vitest";
import type { MemoRecord, ReadAction } from "./approval";
import {
  buildAdvanceStepPayload,
  buildMemoWritePayload,
  buildNewMemoReadActionRows,
  buildNewMemoWorkflowAction,
  buildRejectMemoPayload,
  buildReturnMemoPayload,
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

describe("buildAdvanceStepPayload", () => {
  it("intermediate step produces check/intermediate with updated current_step and pending status", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "General Manager",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.action_type).toBe("check");
    expect(payload.workflowAction.result).toBe("intermediate");
    expect(payload.memoUpdate.status).toBe("pending");
    expect(payload.memoUpdate.workflow_state).toBe("Checked");
    expect(payload.memoUpdate.current_step).toBe("General Manager");
  });

  it("final step produces approve/final with approved status and Approved workflow_state", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "General Manager",
      nextCurrentStep: "General Manager",
      nextStatus: "approved",
      nextWorkflowState: "Approved",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.action_type).toBe("approve");
    expect(payload.workflowAction.result).toBe("final");
    expect(payload.memoUpdate.status).toBe("approved");
    expect(payload.memoUpdate.workflow_state).toBe("Approved");
    expect(payload.memoUpdate.current_step).toBe("General Manager");
  });

  it("step_label is the step before advancing in both intermediate and final cases", () => {
    const intermediate = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "General Manager",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });
    const final = buildAdvanceStepPayload({
      stepLabel: "Managing Director",
      nextCurrentStep: "Managing Director",
      nextStatus: "approved",
      nextWorkflowState: "Approved",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(intermediate.workflowAction.step_label).toBe("Manager / Top Section");
    expect(final.workflowAction.step_label).toBe("Managing Director");
  });

  it("revision_no from body is preserved in the workflow action row", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "Manager / Top Section",
      nextStatus: "approved",
      nextWorkflowState: "Approved",
      revisionNo: 2,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.revision_no).toBe(2);
  });

  it("updatedAt is converted to UTC MySQL DATETIME for both memoUpdate and workflowAction", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "General Manager",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.workflowAction.acted_at).toBe("2026-06-01 07:30:00");
  });

  it("actor_name and metadata_json are always null", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "General Manager",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.actor_name).toBeNull();
    expect(payload.workflowAction.metadata_json).toBeNull();
  });
});

describe("buildReturnMemoPayload", () => {
  it("produces action_type=return_for_revision with null result", () => {
    const payload = buildReturnMemoPayload({
      stepLabel: "General Manager",
      returnReason: "เอกสารไม่ครบ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.action_type).toBe("return_for_revision");
    expect(payload.workflowAction.result).toBeNull();
    expect(payload.memoUpdate.status).toBe("returned");
  });

  it("returnReason appears in both memoUpdate.return_reason and workflowAction.reason", () => {
    const payload = buildReturnMemoPayload({
      stepLabel: "Manager / Top Section",
      returnReason: "ต้องแนบใบเสนอราคาเพิ่มเติม",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.return_reason).toBe("ต้องแนบใบเสนอราคาเพิ่มเติม");
    expect(payload.workflowAction.reason).toBe("ต้องแนบใบเสนอราคาเพิ่มเติม");
  });

  it("step_label is the step before returning and revision_no is preserved", () => {
    const payload = buildReturnMemoPayload({
      stepLabel: "Managing Director",
      returnReason: "ราคาสูงเกินงบ",
      revisionNo: 2,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.step_label).toBe("Managing Director");
    expect(payload.workflowAction.revision_no).toBe(2);
  });

  it("updatedAt is converted to UTC MySQL DATETIME for both memoUpdate and workflowAction", () => {
    const payload = buildReturnMemoPayload({
      stepLabel: "General Manager",
      returnReason: "ข้อมูลไม่ครบ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.workflowAction.acted_at).toBe("2026-06-01 07:30:00");
  });
});

describe("buildRejectMemoPayload", () => {
  it("produces action_type=reject with memoUpdate.status=rejected", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "General Manager",
      disposition: "close",
      rejectReason: "ไม่อนุมัติ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.action_type).toBe("reject");
    expect(payload.memoUpdate.status).toBe("rejected");
  });

  it("disposition appears in memoUpdate.reject_disposition and workflowAction.result for close", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "Managing Director",
      disposition: "close",
      rejectReason: "งบประมาณไม่เพียงพอ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.reject_disposition).toBe("close");
    expect(payload.workflowAction.result).toBe("close");
  });

  it("disposition appears in memoUpdate.reject_disposition and workflowAction.result for revision-allowed", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "General Manager",
      disposition: "revision-allowed",
      rejectReason: "ราคาสูงเกินไป กรุณาเสนอใหม่",
      revisionNo: 1,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.reject_disposition).toBe("revision-allowed");
    expect(payload.workflowAction.result).toBe("revision-allowed");
  });

  it("rejectReason appears in memoUpdate.reject_reason and workflowAction.reason", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "Manager / Top Section",
      disposition: "close",
      rejectReason: "ข้อมูลไม่ถูกต้อง",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.reject_reason).toBe("ข้อมูลไม่ถูกต้อง");
    expect(payload.workflowAction.reason).toBe("ข้อมูลไม่ถูกต้อง");
  });

  it("step_label is the step at rejection and revision_no is preserved", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "Managing Director",
      disposition: "revision-allowed",
      rejectReason: "ต้องการข้อมูลเพิ่ม",
      revisionNo: 2,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.step_label).toBe("Managing Director");
    expect(payload.workflowAction.revision_no).toBe(2);
  });

  it("updatedAt is converted to UTC MySQL DATETIME for both memoUpdate and workflowAction", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "General Manager",
      disposition: "close",
      rejectReason: "ไม่อนุมัติ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.memoUpdate.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.workflowAction.acted_at).toBe("2026-06-01 07:30:00");
  });

  it("actor_name and metadata_json are always null", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "General Manager",
      disposition: "close",
      rejectReason: "ไม่อนุมัติ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
    });

    expect(payload.workflowAction.actor_name).toBeNull();
    expect(payload.workflowAction.metadata_json).toBeNull();
  });
});
