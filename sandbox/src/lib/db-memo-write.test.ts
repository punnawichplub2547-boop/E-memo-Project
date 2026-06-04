import { describe, expect, it } from "vitest";
import type { MemoRecord, ReadAction } from "./approval";
import {
  buildAdvanceStepPayload,
  buildMemoWritePayload,
  buildNewMemoReadActionRows,
  buildNewMemoWorkflowAction,
  buildMarkReadPayload,
  buildRejectMemoPayload,
  buildResubmitMemoPayload,
  buildReturnMemoPayload,
  buildSkipAllReadsPayload,
  buildSubmitRevisionPayload,
  type ResubmitMemoBody,
  type SubmitRevisionBody,
} from "./db-memo-write";
import { memoToDbSeedRow } from "./db-seed";

const ACTOR = "อำภา หิงคำ";

describe("DB memo write helpers", () => {
  const readActions: ReadAction[] = [
    { recipient: "ACC/FIN", status: "pending" },
    { recipient: "HR&GA", status: "read", actedAt: "01 Jun 2026 10:05" },
  ];

  const memo: MemoRecord = {
    id: "EM-20260601-143022-4F7",
    title: "New memo",
    requester: ACTOR,
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
    expect(action.actor_name).toBe(ACTOR);
  });

  it("builds save_draft workflow action for draft memos", () => {
    const draft: MemoRecord = { ...memo, status: "draft" };
    const action = buildNewMemoWorkflowAction(buildMemoWritePayload(draft).row);

    expect(action.action_type).toBe("save_draft");
    expect(action.actor_name).toBe(ACTOR);
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
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
    });
    const final = buildAdvanceStepPayload({
      stepLabel: "Managing Director",
      nextCurrentStep: "Managing Director",
      nextStatus: "approved",
      nextWorkflowState: "Approved",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
    });

    expect(payload.memoUpdate.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.workflowAction.acted_at).toBe("2026-06-01 07:30:00");
  });

  it("actor_name reflects actorName from body; metadata_json is always null", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "General Manager",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.workflowAction.actor_name).toBe(ACTOR);
    expect(payload.workflowAction.metadata_json).toBeNull();
  });

  it("actor_name is null when actorName body field is null", () => {
    const payload = buildAdvanceStepPayload({
      stepLabel: "Manager / Top Section",
      nextCurrentStep: "General Manager",
      nextStatus: "pending",
      nextWorkflowState: "Checked",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
      actorName: null,
    });

    expect(payload.workflowAction.actor_name).toBeNull();
  });
});

describe("buildReturnMemoPayload", () => {
  it("produces action_type=return_for_revision with null result", () => {
    const payload = buildReturnMemoPayload({
      stepLabel: "General Manager",
      returnReason: "เอกสารไม่ครบ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
    });

    expect(payload.memoUpdate.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.workflowAction.acted_at).toBe("2026-06-01 07:30:00");
  });

  it("actor_name reflects actorName from body", () => {
    const payload = buildReturnMemoPayload({
      stepLabel: "General Manager",
      returnReason: "เอกสารไม่ครบ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.workflowAction.actor_name).toBe(ACTOR);
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
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
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
      actorName: ACTOR,
    });

    expect(payload.memoUpdate.updated_at).toBe("2026-06-01 07:30:00");
    expect(payload.workflowAction.acted_at).toBe("2026-06-01 07:30:00");
  });

  it("actor_name reflects actorName from body; metadata_json is always null", () => {
    const payload = buildRejectMemoPayload({
      stepLabel: "General Manager",
      disposition: "close",
      rejectReason: "ไม่อนุมัติ",
      revisionNo: 0,
      updatedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.workflowAction.actor_name).toBe(ACTOR);
    expect(payload.workflowAction.metadata_json).toBeNull();
  });
});

describe("buildMarkReadPayload", () => {
  it("marks one recipient as read and converts actedAt to UTC", () => {
    const payload = buildMarkReadPayload({
      recipient: "ACC/FIN",
      revisionNo: 0,
      actedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.readActionUpdate.status).toBe("read");
    expect(payload.readActionUpdate.acted_at).toBe("2026-06-01 07:30:00");
    expect(payload.readActionUpdate.updated_at).toBe("2026-06-01 07:30:00");
  });

  it("creates a read workflow action with recipient metadata and actor_name from body", () => {
    const payload = buildMarkReadPayload({
      recipient: "HR&GA",
      revisionNo: 2,
      actedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.workflowAction.revision_no).toBe(2);
    expect(payload.workflowAction.action_type).toBe("read");
    expect(payload.workflowAction.actor_name).toBe(ACTOR);
    expect(payload.workflowAction.reason).toBeNull();
    expect(payload.workflowAction.metadata_json).toBe(JSON.stringify({ recipient: "HR&GA" }));
  });
});

describe("buildSkipAllReadsPayload", () => {
  it("marks pending recipients as skipped with reason and UTC timestamps", () => {
    const payload = buildSkipAllReadsPayload({
      recipients: ["ACC/FIN", "HR&GA"],
      skipReason: "MD requested urgent approval",
      revisionNo: 0,
      actedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.readActionUpdate.status).toBe("skipped");
    expect(payload.readActionUpdate.skip_reason).toBe("MD requested urgent approval");
    expect(payload.readActionUpdate.acted_at).toBe("2026-06-01 07:30:00");
    expect(payload.readActionUpdate.updated_at).toBe("2026-06-01 07:30:00");
  });

  it("creates a skip_read workflow action with skip reason, recipients metadata, and actor_name from body", () => {
    const payload = buildSkipAllReadsPayload({
      recipients: ["ACC/FIN", "HR&GA"],
      skipReason: "เร่งด่วน",
      revisionNo: 1,
      actedAt: "01 Jun 2026 14:30",
      actorName: ACTOR,
    });

    expect(payload.workflowAction.revision_no).toBe(1);
    expect(payload.workflowAction.action_type).toBe("skip_read");
    expect(payload.workflowAction.actor_name).toBe(ACTOR);
    expect(payload.workflowAction.result).toBeNull();
    expect(payload.workflowAction.reason).toBe("เร่งด่วน");
    expect(payload.workflowAction.metadata_json).toBe(JSON.stringify({ recipients: ["ACC/FIN", "HR&GA"] }));
  });
});

describe("buildResubmitMemoPayload", () => {
  const baseBody: ResubmitMemoBody = {
    oldRevisionNo: 0,
    source: "return",
    returnReason: "เอกสารไม่ครบ",
    rejectReason: null,
    revisionNote: "แนบใบเสนอราคาแล้ว",
    oldSubmittedAt: "01 Jun 2026 14:30",
    snapshotJson: JSON.stringify({ title: "Test Memo", amount: 12000, category: "general-purchase", selectedRoute: ["Manager / Top Section"], readRecipients: ["ACC/FIN"] }),
    nextCurrentStep: "Manager / Top Section",
    readRecipients: ["ACC/FIN", "HR&GA"],
    updatedAt: "02 Jun 2026 09:00",
    actorName: ACTOR,
  };

  it("memoRevision.revision_no is old; memoUpdate, workflowAction, and newReadActions use new (old + 1)", () => {
    const payload = buildResubmitMemoPayload(baseBody);

    expect(payload.memoRevision.revision_no).toBe(0);
    expect(payload.memoUpdate.revision_no).toBe(1);
    expect(payload.workflowAction.revision_no).toBe(1);
    expect(payload.newReadActions[0].revision_no).toBe(1);
  });

  it("revision_no arithmetic holds for any oldRevisionNo", () => {
    const payload = buildResubmitMemoPayload({ ...baseBody, oldRevisionNo: 2 });

    expect(payload.memoRevision.revision_no).toBe(2);
    expect(payload.memoUpdate.revision_no).toBe(3);
    expect(payload.workflowAction.revision_no).toBe(3);
  });

  it("source return → memoRevision.source is return with returnReason preserved", () => {
    const payload = buildResubmitMemoPayload(baseBody);

    expect(payload.memoRevision.source).toBe("return");
    expect(payload.memoRevision.return_reason).toBe("เอกสารไม่ครบ");
    expect(payload.memoRevision.reject_reason).toBeNull();
  });

  it("source rejection-allowed → memoRevision.source is rejection-allowed with rejectReason preserved", () => {
    const rejBody: ResubmitMemoBody = {
      ...baseBody,
      source: "rejection-allowed",
      returnReason: null,
      rejectReason: "ราคาเกินวงเงิน",
    };
    const payload = buildResubmitMemoPayload(rejBody);

    expect(payload.memoRevision.source).toBe("rejection-allowed");
    expect(payload.memoRevision.reject_reason).toBe("ราคาเกินวงเงิน");
    expect(payload.memoRevision.return_reason).toBeNull();
  });

  it("snapshotJson is passed through verbatim to memoRevision.snapshot_json", () => {
    const snap = JSON.stringify({ title: "My Memo", amount: 9500, category: "raw-material", selectedRoute: ["Managing Director"], readRecipients: ["IT", "HR&GA"] });
    const payload = buildResubmitMemoPayload({ ...baseBody, snapshotJson: snap });

    expect(payload.memoRevision.snapshot_json).toBe(snap);
    const parsed = JSON.parse(payload.memoRevision.snapshot_json) as Record<string, unknown>;
    expect(parsed.title).toBe("My Memo");
    expect(parsed.amount).toBe(9500);
    expect(parsed.category).toBe("raw-material");
    expect(parsed.selectedRoute).toEqual(["Managing Director"]);
    expect(parsed.readRecipients).toEqual(["IT", "HR&GA"]);
  });

  it("memoUpdate clears return_reason, reject_reason, reject_disposition and sets pending/Issued", () => {
    const payload = buildResubmitMemoPayload(baseBody);

    expect(payload.memoUpdate.status).toBe("pending");
    expect(payload.memoUpdate.workflow_state).toBe("Issued");
    expect(payload.memoUpdate.return_reason).toBeNull();
    expect(payload.memoUpdate.reject_reason).toBeNull();
    expect(payload.memoUpdate.reject_disposition).toBeNull();
  });

  it("memoUpdate.current_step matches body.nextCurrentStep", () => {
    const payload = buildResubmitMemoPayload({ ...baseBody, nextCurrentStep: "General Manager" });

    expect(payload.memoUpdate.current_step).toBe("General Manager");
  });

  it("newReadActions has one pending entry per recipient with null acted_at and skip_reason", () => {
    const payload = buildResubmitMemoPayload(baseBody);

    expect(payload.newReadActions).toHaveLength(2);
    expect(payload.newReadActions[0]).toEqual({
      revision_no: 1,
      recipient_name: "ACC/FIN",
      status: "pending",
      acted_at: null,
      skip_reason: null,
      created_at: "2026-06-02 02:00:00",
      updated_at: "2026-06-02 02:00:00",
    });
    expect(payload.newReadActions[1].recipient_name).toBe("HR&GA");
  });

  it("newReadActions is empty when readRecipients is empty", () => {
    const payload = buildResubmitMemoPayload({ ...baseBody, readRecipients: [] });

    expect(payload.newReadActions).toHaveLength(0);
  });

  it("workflowAction is action_type=resubmit result=quick with null step_label and metadata_json; actor_name from body", () => {
    const payload = buildResubmitMemoPayload(baseBody);

    expect(payload.workflowAction.action_type).toBe("resubmit");
    expect(payload.workflowAction.result).toBe("quick");
    expect(payload.workflowAction.step_label).toBeNull();
    expect(payload.workflowAction.actor_name).toBe(ACTOR);
    expect(payload.workflowAction.metadata_json).toBeNull();
  });

  it("workflowAction.reason mirrors body.revisionNote (null when omitted)", () => {
    const withNote = buildResubmitMemoPayload(baseBody);
    const noNote = buildResubmitMemoPayload({ ...baseBody, revisionNote: null });

    expect(withNote.workflowAction.reason).toBe("แนบใบเสนอราคาแล้ว");
    expect(noNote.workflowAction.reason).toBeNull();
  });

  it("oldSubmittedAt is converted to UTC in memoRevision.submitted_at", () => {
    const payload = buildResubmitMemoPayload(baseBody);

    expect(payload.memoRevision.submitted_at).toBe("2026-06-01 07:30:00");
  });

  it("updatedAt is converted to UTC in memoUpdate, workflowAction, newReadActions, and memoRevision.created_at", () => {
    const payload = buildResubmitMemoPayload(baseBody);
    const utc = "2026-06-02 02:00:00";

    expect(payload.memoRevision.created_at).toBe(utc);
    expect(payload.memoUpdate.updated_at).toBe(utc);
    expect(payload.memoUpdate.revision_submitted_at).toBe(utc);
    expect(payload.workflowAction.acted_at).toBe(utc);
    expect(payload.newReadActions[0].created_at).toBe(utc);
    expect(payload.newReadActions[0].updated_at).toBe(utc);
  });
});

describe("buildSubmitRevisionPayload", () => {
  const prevMemo: MemoRecord = {
    id: "EM-20260601-143022-4F7",
    title: "Old Memo Title",
    requester: ACTOR,
    department: "HR&GA",
    category: "general-purchase",
    amount: 5000,
    status: "returned",
    currentStep: "Manager / Top Section",
    workflowState: "Issued",
    cycleHours: 0,
    revisionNo: 1,
    revisionSubmittedAt: "01 Jun 2026 14:30",
    returnReason: "เอกสารไม่ครบ",
    createdAt: "01 Jun 2026 09:00",
    updatedAt: "01 Jun 2026 14:30",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    readRecipients: ["ACC/FIN"],
  };

  const nextMemo: MemoRecord = {
    ...prevMemo,
    title: "New Revised Title",
    amount: 15000,
    category: "raw-material" as const,
    status: "pending" as const,
    workflowState: "Issued" as const,
    revisionNo: 2,
    returnReason: undefined,
    rejectReason: undefined,
    rejectDisposition: undefined,
    updatedAt: "02 Jun 2026 09:00",
    revisionSubmittedAt: "02 Jun 2026 09:00",
    readActions: [{ recipient: "ACC/FIN", status: "pending" as const }],
  };

  const baseNextMemoRow = memoToDbSeedRow(nextMemo);
  const baseSnapshotJson = JSON.stringify({
    title: "Old Memo Title",
    amount: 5000,
    category: "general-purchase",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    readRecipients: ["ACC/FIN"],
  });

  const baseBody: SubmitRevisionBody = {
    oldRevisionNo: 1,
    source: "return",
    returnReason: "เอกสารไม่ครบ",
    rejectReason: null,
    revisionNote: null,
    oldSubmittedAt: "01 Jun 2026 14:30",
    snapshotJson: baseSnapshotJson,
    nextMemoRow: baseNextMemoRow,
    readRecipients: ["ACC/FIN"],
    actorName: ACTOR,
  };

  it("memoRevision uses oldRevisionNo; memoUpdate, workflowAction, newReadActions use new (old+1)", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    expect(payload.memoRevision.revision_no).toBe(1);
    expect(payload.memoUpdate.revision_no).toBe(2);
    expect(payload.workflowAction.revision_no).toBe(2);
    expect(payload.newReadActions[0].revision_no).toBe(2);
  });

  it("revision_no arithmetic holds for any oldRevisionNo", () => {
    const payload = buildSubmitRevisionPayload({ ...baseBody, oldRevisionNo: 3 });

    expect(payload.memoRevision.revision_no).toBe(3);
    expect(payload.memoUpdate.revision_no).toBe(4);
    expect(payload.workflowAction.revision_no).toBe(4);
  });

  it("overrides nextMemoRow.revision_no to oldRevisionNo+1 even when nextMemoRow has wrong value", () => {
    const wrongRow = { ...baseNextMemoRow, revision_no: 99 };
    const payload = buildSubmitRevisionPayload({ ...baseBody, nextMemoRow: wrongRow });

    expect(payload.memoUpdate.revision_no).toBe(2);
    expect(payload.workflowAction.revision_no).toBe(2);
    expect(payload.newReadActions[0].revision_no).toBe(2);
  });

  it("snapshot_json contains OLD title and amount; memoUpdate contains NEW title and amount", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    const snap = JSON.parse(payload.memoRevision.snapshot_json) as Record<string, unknown>;
    expect(snap.title).toBe("Old Memo Title");
    expect(snap.amount).toBe(5000);
    expect(payload.memoUpdate.title).toBe("New Revised Title");
    expect(payload.memoUpdate.amount).toBe(15000);
  });

  it("source return → returnReason preserved, rejectReason null in memoRevision", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    expect(payload.memoRevision.source).toBe("return");
    expect(payload.memoRevision.return_reason).toBe("เอกสารไม่ครบ");
    expect(payload.memoRevision.reject_reason).toBeNull();
  });

  it("source rejection-allowed → rejectReason preserved, returnReason null in memoRevision", () => {
    const payload = buildSubmitRevisionPayload({
      ...baseBody,
      source: "rejection-allowed",
      returnReason: null,
      rejectReason: "ราคาเกินวงเงิน",
    });

    expect(payload.memoRevision.source).toBe("rejection-allowed");
    expect(payload.memoRevision.reject_reason).toBe("ราคาเกินวงเงิน");
    expect(payload.memoRevision.return_reason).toBeNull();
  });

  it("snapshotJson is passed through verbatim to memoRevision.snapshot_json", () => {
    const custom = JSON.stringify({ title: "Custom", amount: 999 });
    const payload = buildSubmitRevisionPayload({ ...baseBody, snapshotJson: custom });

    expect(payload.memoRevision.snapshot_json).toBe(custom);
  });

  it("memoUpdate carries pending/Issued status and null return/reject fields from nextMemoRow", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    expect(payload.memoUpdate.status).toBe("pending");
    expect(payload.memoUpdate.workflow_state).toBe("Issued");
    expect(payload.memoUpdate.return_reason).toBeNull();
    expect(payload.memoUpdate.reject_reason).toBeNull();
    expect(payload.memoUpdate.reject_disposition).toBeNull();
  });

  it("newReadActions has one pending entry per recipient with new revision_no and null timestamps", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    expect(payload.newReadActions).toHaveLength(1);
    expect(payload.newReadActions[0]).toMatchObject({
      revision_no: 2,
      recipient_name: "ACC/FIN",
      status: "pending",
      acted_at: null,
      skip_reason: null,
    });
  });

  it("newReadActions is empty when readRecipients is empty", () => {
    const payload = buildSubmitRevisionPayload({ ...baseBody, readRecipients: [] });

    expect(payload.newReadActions).toHaveLength(0);
  });

  it("workflowAction is action_type=resubmit result=edit-and-resubmit with null step_label and metadata_json; actor_name from body", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    expect(payload.workflowAction.action_type).toBe("resubmit");
    expect(payload.workflowAction.result).toBe("edit-and-resubmit");
    expect(payload.workflowAction.step_label).toBeNull();
    expect(payload.workflowAction.actor_name).toBe(ACTOR);
    expect(payload.workflowAction.metadata_json).toBeNull();
  });

  it("workflowAction.reason and memoRevision.revision_note mirror body.revisionNote", () => {
    const withNote = buildSubmitRevisionPayload({ ...baseBody, revisionNote: "แก้ไขราคา" });
    const noNote = buildSubmitRevisionPayload(baseBody);

    expect(withNote.workflowAction.reason).toBe("แก้ไขราคา");
    expect(withNote.memoRevision.revision_note).toBe("แก้ไขราคา");
    expect(noNote.workflowAction.reason).toBeNull();
    expect(noNote.memoRevision.revision_note).toBeNull();
  });

  it("oldSubmittedAt is converted to UTC in memoRevision.submitted_at", () => {
    const payload = buildSubmitRevisionPayload(baseBody);

    expect(payload.memoRevision.submitted_at).toBe("2026-06-01 07:30:00");
  });

  it("memoRevision.created_at, workflowAction.acted_at, and newReadActions timestamps equal nextMemoRow.updated_at verbatim (no re-conversion)", () => {
    const payload = buildSubmitRevisionPayload(baseBody);
    const expected = baseNextMemoRow.updated_at;

    expect(payload.memoRevision.created_at).toBe(expected);
    expect(payload.workflowAction.acted_at).toBe(expected);
    expect(payload.newReadActions[0].created_at).toBe(expected);
    expect(payload.newReadActions[0].updated_at).toBe(expected);
  });
});
