import { describe, expect, it } from "vitest";
import { buildMemoSnapshot, memoReducer } from "./memo-store";
import { seedMemos, type MemoRecord } from "./approval";

describe("memoReducer — HYDRATE_MEMOS", () => {
  it("accepts an empty DB result instead of falling back to seed memos", () => {
    const next = memoReducer(seedMemos, { type: "HYDRATE_MEMOS", memos: [] });
    expect(next).toEqual([]);
  });

  it("replaces the current prototype state with the DB result", () => {
    const dbMemo = { ...seedMemos[0], id: "EM-DB-ONLY" };
    const next = memoReducer(seedMemos, { type: "HYDRATE_MEMOS", memos: [dbMemo] });
    expect(next).toEqual([dbMemo]);
  });
});

describe("memoReducer — RETURN_MEMO", () => {
  const state = seedMemos.slice(0, 2);
  const target = state[0];

  it("sets status to returned and stores returnReason", () => {
    const next = memoReducer(state, {
      type: "RETURN_MEMO",
      id: target.id,
      returnReason: "เอกสารไม่ครบ",
      updatedAt: "28 May 2026 10:00",
    });
    const updated = next.find((m) => m.id === target.id)!;
    expect(updated.status).toBe("returned");
    expect(updated.returnReason).toBe("เอกสารไม่ครบ");
    expect(updated.updatedAt).toBe("28 May 2026 10:00");
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer(state, {
      type: "RETURN_MEMO",
      id: target.id,
      returnReason: "เอกสารไม่ครบ",
    });
    expect(next.find((m) => m.id !== target.id)).toEqual(state[1]);
  });

  it("falls back to existing updatedAt when none provided", () => {
    const next = memoReducer(state, {
      type: "RETURN_MEMO",
      id: target.id,
      returnReason: "test",
    });
    expect(next.find((m) => m.id === target.id)!.updatedAt).toBe(target.updatedAt);
  });
});

describe("memoReducer — RESUBMIT_MEMO", () => {
  const returnedBase: MemoRecord = {
    ...seedMemos[0],
    status: "returned",
    returnReason: "เอกสารไม่ครบ",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    updatedAt: "28 May 2026 10:00",
  };
  const noRoute: MemoRecord = { ...returnedBase, selectedRoute: undefined };
  const other: MemoRecord = { ...seedMemos[1] };
  const state = [returnedBase, noRoute, other];

  it("sets status to pending", () => {
    const next = memoReducer(state, { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(next.find((m) => m.id === returnedBase.id)!.status).toBe("pending");
  });

  it("resets currentStep to first of selectedRoute", () => {
    const next = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(next[0].currentStep).toBe("Manager / Top Section");
  });

  it("falls back to Manager / Top Section when selectedRoute is undefined", () => {
    const next = memoReducer([noRoute], { type: "RESUBMIT_MEMO", id: noRoute.id });
    expect(next[0].currentStep).toBe("Manager / Top Section");
  });

  it("sets workflowState to Issued", () => {
    const next = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(next[0].workflowState).toBe("Issued");
  });

  it("clears returnReason from live record after resubmit — reason is preserved in revisions", () => {
    const next = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(next[0].returnReason).toBeUndefined();
    expect(next[0].revisions![0].returnReason).toBe("เอกสารไม่ครบ");
  });

  it("stores revisionNote when provided", () => {
    const next = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id, revisionNote: "แนบใบเสนอราคาแล้ว" });
    expect(next[0].revisionNote).toBe("แนบใบเสนอราคาแล้ว");
  });

  it("leaves revisionNote undefined when not provided", () => {
    const next = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(next[0].revisionNote).toBeUndefined();
  });

  it("uses provided updatedAt; falls back to existing when omitted", () => {
    const withTs = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id, updatedAt: "29 May 2026 09:00" });
    expect(withTs[0].updatedAt).toBe("29 May 2026 09:00");
    const noTs = memoReducer([returnedBase], { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(noTs[0].updatedAt).toBe(returnedBase.updatedAt);
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer(state, { type: "RESUBMIT_MEMO", id: returnedBase.id });
    expect(next.find((m) => m.id === other.id)).toEqual(other);
  });

  it("resets readActions to pending and clears actedAt/skipReason on resubmit", () => {
    const withReads: MemoRecord = {
      ...returnedBase,
      readActions: [
        { recipient: "HR&GA", status: "read", actedAt: "28 May 2026 09:00" },
        { recipient: "IT", status: "skipped", skipReason: "ไม่มีเวลา", actedAt: "28 May 2026 09:05" },
      ],
    };
    const next = memoReducer([withReads], { type: "RESUBMIT_MEMO", id: withReads.id });
    expect(next[0].readActions).toEqual([
      { recipient: "HR&GA", status: "pending" },
      { recipient: "IT", status: "pending" },
    ]);
  });
});

describe("memoReducer — ADVANCE_STEP", () => {
  const mgr2gm: MemoRecord = {
    ...seedMemos[0],
    status: "pending",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    currentStep: "Manager / Top Section",
    updatedAt: "28 May 2026 10:00",
  };
  const fullRoute: MemoRecord = {
    ...seedMemos[0],
    status: "pending",
    selectedRoute: ["Manager / Top Section", "General Manager", "Managing Director"],
    currentStep: "Manager / Top Section",
    updatedAt: "28 May 2026 10:00",
  };
  const noRoute: MemoRecord = { ...seedMemos[0], status: "pending", selectedRoute: undefined };
  const other: MemoRecord = { ...seedMemos[1] };

  it("advances currentStep from Manager to GM, status stays pending, workflowState Checked", () => {
    const next = memoReducer([mgr2gm], { type: "ADVANCE_STEP", id: mgr2gm.id });
    expect(next[0].currentStep).toBe("General Manager");
    expect(next[0].status).toBe("pending");
    expect(next[0].workflowState).toBe("Checked");
  });

  it("approves at final step (GM last in 2-step route), workflowState Approved, currentStep unchanged", () => {
    const atGm: MemoRecord = { ...mgr2gm, currentStep: "General Manager" };
    const next = memoReducer([atGm], { type: "ADVANCE_STEP", id: atGm.id });
    expect(next[0].status).toBe("approved");
    expect(next[0].workflowState).toBe("Approved");
    expect(next[0].currentStep).toBe("General Manager");
  });

  it("advances GM → MD in 3-step route, status stays pending", () => {
    const gmInFull: MemoRecord = { ...fullRoute, currentStep: "General Manager" };
    const next = memoReducer([gmInFull], { type: "ADVANCE_STEP", id: gmInFull.id });
    expect(next[0].currentStep).toBe("Managing Director");
    expect(next[0].status).toBe("pending");
  });

  it("approves at MD (last in 3-step route)", () => {
    const atMd: MemoRecord = { ...fullRoute, currentStep: "Managing Director" };
    const next = memoReducer([atMd], { type: "ADVANCE_STEP", id: atMd.id });
    expect(next[0].status).toBe("approved");
    expect(next[0].workflowState).toBe("Approved");
  });

  it("approves terminally when selectedRoute is undefined", () => {
    const next = memoReducer([noRoute], { type: "ADVANCE_STEP", id: noRoute.id });
    expect(next[0].status).toBe("approved");
    expect(next[0].workflowState).toBe("Approved");
  });

  it("approves terminally when currentStep is not found in selectedRoute (idx = -1)", () => {
    const notInRoute: MemoRecord = { ...mgr2gm, currentStep: "Managing Director" };
    const next = memoReducer([notInRoute], { type: "ADVANCE_STEP", id: notInRoute.id });
    expect(next[0].status).toBe("approved");
  });

  it("uses provided updatedAt; falls back to existing when omitted", () => {
    const withTs = memoReducer([mgr2gm], { type: "ADVANCE_STEP", id: mgr2gm.id, updatedAt: "29 May 2026 09:00" });
    expect(withTs[0].updatedAt).toBe("29 May 2026 09:00");
    const noTs = memoReducer([mgr2gm], { type: "ADVANCE_STEP", id: mgr2gm.id });
    expect(noTs[0].updatedAt).toBe(mgr2gm.updatedAt);
  });

  it("leaves non-pending memos unchanged", () => {
    const approved: MemoRecord = { ...seedMemos[0], status: "approved" };
    const next = memoReducer([approved], { type: "ADVANCE_STEP", id: approved.id });
    expect(next[0]).toEqual(approved);
  });

  it("preserves returnReason and revisionNote through step advancement", () => {
    const memo: MemoRecord = { ...mgr2gm, returnReason: "เอกสารไม่ครบ", revisionNote: "แนบใบเสนอราคาแล้ว" };
    const next = memoReducer([memo], { type: "ADVANCE_STEP", id: memo.id });
    expect(next[0].returnReason).toBe("เอกสารไม่ครบ");
    expect(next[0].revisionNote).toBe("แนบใบเสนอราคาแล้ว");
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer([mgr2gm, other], { type: "ADVANCE_STEP", id: mgr2gm.id });
    expect(next.find((m) => m.id === other.id)).toEqual(other);
  });
});

describe("memoReducer — MARK_READ", () => {
  const withReads: MemoRecord = {
    ...seedMemos[0],
    status: "pending",
    readActions: [
      { recipient: "HR&GA", status: "pending" },
      { recipient: "IT", status: "pending" },
    ],
    updatedAt: "28 May 2026 10:00",
  };
  const other: MemoRecord = { ...seedMemos[1] };

  it("marks specific recipient as read and stamps actedAt", () => {
    const next = memoReducer([withReads], { type: "MARK_READ", id: withReads.id, recipient: "HR&GA", actedAt: "28 May 2026 11:00" });
    expect(next[0].readActions![0]).toEqual({ recipient: "HR&GA", status: "read", actedAt: "28 May 2026 11:00" });
  });

  it("leaves other readAction entries unchanged", () => {
    const next = memoReducer([withReads], { type: "MARK_READ", id: withReads.id, recipient: "HR&GA", actedAt: "28 May 2026 11:00" });
    expect(next[0].readActions![1]).toEqual({ recipient: "IT", status: "pending" });
  });

  it("falls back to existing actedAt when not provided", () => {
    const withActedAt: MemoRecord = {
      ...withReads,
      readActions: [{ recipient: "HR&GA", status: "pending", actedAt: "existing" }, { recipient: "IT", status: "pending" }],
    };
    const next = memoReducer([withActedAt], { type: "MARK_READ", id: withActedAt.id, recipient: "HR&GA" });
    expect(next[0].readActions![0].actedAt).toBe("existing");
  });

  it("no-op when recipient not found in readActions", () => {
    const next = memoReducer([withReads], { type: "MARK_READ", id: withReads.id, recipient: "NOTEXIST" });
    expect(next[0].readActions).toEqual(withReads.readActions);
  });

  it("leaves non-pending memos unchanged", () => {
    const approved: MemoRecord = { ...withReads, status: "approved" };
    const next = memoReducer([approved], { type: "MARK_READ", id: approved.id, recipient: "HR&GA" });
    expect(next[0]).toEqual(approved);
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer([withReads, other], { type: "MARK_READ", id: withReads.id, recipient: "HR&GA" });
    expect(next.find((m) => m.id === other.id)).toEqual(other);
  });
});

describe("memoReducer — REJECT_MEMO", () => {
  const target: MemoRecord = { ...seedMemos[0], status: "pending" };
  const other: MemoRecord = { ...seedMemos[1] };
  const state = [target, other];

  it("sets status to rejected with close disposition and stores rejectReason", () => {
    const next = memoReducer(state, { type: "REJECT_MEMO", id: target.id, disposition: "close", reason: "ราคาสูงเกินงบ", updatedAt: "29 May 2026 14:00" });
    const updated = next.find((m) => m.id === target.id)!;
    expect(updated.status).toBe("rejected");
    expect(updated.rejectDisposition).toBe("close");
    expect(updated.rejectReason).toBe("ราคาสูงเกินงบ");
    expect(updated.updatedAt).toBe("29 May 2026 14:00");
  });

  it("sets status to rejected with revision-allowed disposition", () => {
    const next = memoReducer(state, { type: "REJECT_MEMO", id: target.id, disposition: "revision-allowed", reason: "ต้องแนบเอกสารเพิ่มเติม" });
    const updated = next.find((m) => m.id === target.id)!;
    expect(updated.status).toBe("rejected");
    expect(updated.rejectDisposition).toBe("revision-allowed");
    expect(updated.rejectReason).toBe("ต้องแนบเอกสารเพิ่มเติม");
  });

  it("falls back to existing updatedAt when none provided", () => {
    const next = memoReducer(state, { type: "REJECT_MEMO", id: target.id, disposition: "close", reason: "test" });
    expect(next.find((m) => m.id === target.id)!.updatedAt).toBe(target.updatedAt);
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer(state, { type: "REJECT_MEMO", id: target.id, disposition: "close", reason: "test" });
    expect(next.find((m) => m.id === other.id)).toEqual(other);
  });

  it("backward-compat: existing rejected memo with no rejectDisposition is not treated as revision-allowed", () => {
    // Legacy/imported memos may have status "rejected" but no rejectDisposition (closed by default).
    const legacy: MemoRecord = {
      ...seedMemos[0],
      id: "EM-LEGACY-REJECT",
      status: "rejected",
      rejectDisposition: undefined,
    };
    expect(legacy.rejectDisposition).toBeUndefined();
    // The drawer condition for showing Resubmit is: status === "rejected" && rejectDisposition === "revision-allowed".
    // With rejectDisposition undefined, this evaluates to false — memo is treated as closed.
    expect(legacy.rejectDisposition === "revision-allowed").toBe(false);
  });
});

describe("memoReducer — RESUBMIT_MEMO revision semantics", () => {
  const revBase: MemoRecord = {
    id: "EM-2026-REV",
    title: "Test Revision Memo",
    requester: "Test User",
    department: "IT",
    category: "general-purchase",
    amount: 5000,
    status: "returned",
    currentStep: "Manager / Top Section",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    returnReason: "เอกสารไม่ครบ",
    cycleHours: 0,
    updatedAt: "01 Jun 2026 14:00",
  };

  it("creates a revision entry and increments revisionNo on first resubmit from returned status", () => {
    const result = memoReducer([revBase], { type: "RESUBMIT_MEMO", id: revBase.id });
    expect(result[0].revisionNo).toBe(1);
    expect(result[0].revisions).toHaveLength(1);
    expect(result[0].revisions![0].revisionNo).toBe(0);
    expect(result[0].revisions![0].source).toBe("return");
  });

  it("treats missing revisionNo as Rev.0 — first resubmit yields Rev.1", () => {
    const noRevNo: MemoRecord = { ...revBase, revisionNo: undefined };
    const result = memoReducer([noRevNo], { type: "RESUBMIT_MEMO", id: noRevNo.id });
    expect(result[0].revisionNo).toBe(1);
    expect(result[0].revisions![0].revisionNo).toBe(0);
  });

  it("snapshot captures content from before the resubmit", () => {
    const result = memoReducer([revBase], { type: "RESUBMIT_MEMO", id: revBase.id });
    const snap = result[0].revisions![0].snapshot;
    expect(snap.title).toBe("Test Revision Memo");
    expect(snap.amount).toBe(5000);
    expect(snap.category).toBe("general-purchase");
    expect(snap.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
  });

  it("preserves returnReason in revision entry when source is return", () => {
    const result = memoReducer([revBase], { type: "RESUBMIT_MEMO", id: revBase.id });
    expect(result[0].revisions![0].returnReason).toBe("เอกสารไม่ครบ");
    expect(result[0].revisions![0].rejectReason).toBeUndefined();
  });

  it("stores revisionNote in the revision entry when provided", () => {
    const result = memoReducer([revBase], { type: "RESUBMIT_MEMO", id: revBase.id, revisionNote: "แนบใบเสนอราคาแล้ว" });
    expect(result[0].revisions![0].revisionNote).toBe("แนบใบเสนอราคาแล้ว");
  });

  it("second resubmit yields revisionNo 2 and two revision entries", () => {
    const afterFirst = memoReducer([revBase], { type: "RESUBMIT_MEMO", id: revBase.id, updatedAt: "02 Jun 2026 09:00" });
    const returnedAgain = memoReducer(afterFirst, {
      type: "RETURN_MEMO",
      id: revBase.id,
      returnReason: "ยังขาดเอกสาร",
      updatedAt: "03 Jun 2026 14:00",
    });
    const afterSecond = memoReducer(returnedAgain, { type: "RESUBMIT_MEMO", id: revBase.id, updatedAt: "04 Jun 2026 10:00" });
    expect(afterSecond[0].revisionNo).toBe(2);
    expect(afterSecond[0].revisions).toHaveLength(2);
    expect(afterSecond[0].revisions![0].revisionNo).toBe(0);
    expect(afterSecond[0].revisions![1].revisionNo).toBe(1);
    expect(afterSecond[0].revisions![1].source).toBe("return");
    expect(afterSecond[0].revisions![1].returnReason).toBe("ยังขาดเอกสาร");
  });

  it("creates revision entry from rejected+revision-allowed with correct source and rejectReason", () => {
    const rejectedRevision: MemoRecord = {
      ...revBase,
      status: "rejected",
      rejectDisposition: "revision-allowed",
      rejectReason: "ราคาเกินวงเงิน",
      returnReason: undefined,
    };
    const result = memoReducer([rejectedRevision], { type: "RESUBMIT_MEMO", id: rejectedRevision.id });
    expect(result[0].revisionNo).toBe(1);
    expect(result[0].revisions![0].source).toBe("rejection-allowed");
    expect(result[0].revisions![0].rejectReason).toBe("ราคาเกินวงเงิน");
    expect(result[0].revisions![0].returnReason).toBeUndefined();
  });

  it("does NOT create a revision entry for rejected+close — memo stays unchanged", () => {
    const closedRejected: MemoRecord = {
      ...revBase,
      status: "rejected",
      rejectDisposition: "close",
      rejectReason: "ปิดคำขอ",
    };
    const result = memoReducer([closedRejected], { type: "RESUBMIT_MEMO", id: closedRejected.id });
    expect(result[0].status).toBe("rejected");
    expect(result[0].revisionNo).toBeUndefined();
    expect(result[0].revisions).toBeUndefined();
  });

  it("does NOT create a revision entry for a pending memo — memo stays unchanged", () => {
    const pendingMemo: MemoRecord = { ...revBase, status: "pending" };
    const result = memoReducer([pendingMemo], { type: "RESUBMIT_MEMO", id: pendingMemo.id });
    expect(result[0].status).toBe("pending");
    expect(result[0].revisionNo).toBeUndefined();
    expect(result[0].revisions).toBeUndefined();
  });

  // Issue 1 — clearing live reject fields
  it("clears rejectReason and rejectDisposition from live record after resubmit from rejected+revision-allowed", () => {
    const rejectedRevision: MemoRecord = {
      ...revBase,
      status: "rejected",
      rejectDisposition: "revision-allowed",
      rejectReason: "ราคาเกินวงเงิน",
      returnReason: undefined,
    };
    const result = memoReducer([rejectedRevision], { type: "RESUBMIT_MEMO", id: rejectedRevision.id });
    expect(result[0].rejectReason).toBeUndefined();
    expect(result[0].rejectDisposition).toBeUndefined();
    expect(result[0].revisions![0].rejectReason).toBe("ราคาเกินวงเงิน");
  });

  // Issue 2 — submittedAt accuracy
  it("snapshot submittedAt uses createdAt (submission time), not updatedAt (return/reject time)", () => {
    const memo: MemoRecord = {
      ...revBase,
      createdAt: "01 Jun 2026 10:00",
      updatedAt: "02 Jun 2026 14:00", // overwritten by RETURN_MEMO to return time
    };
    const result = memoReducer([memo], { type: "RESUBMIT_MEMO", id: memo.id, updatedAt: "03 Jun 2026 09:00" });
    expect(result[0].revisions![0].submittedAt).toBe("01 Jun 2026 10:00");
  });

  it("second resubmit snapshot submittedAt uses revisionSubmittedAt from first resubmit, not the return time", () => {
    const memoWithCreatedAt: MemoRecord = { ...revBase, createdAt: "01 Jun 2026 10:00", updatedAt: "01 Jun 2026 10:00" };
    // First resubmit at "02 Jun 09:00" → live revisionSubmittedAt set to this timestamp
    const afterFirst = memoReducer([memoWithCreatedAt], {
      type: "RESUBMIT_MEMO", id: revBase.id, updatedAt: "02 Jun 2026 09:00",
    });
    // RETURN_MEMO overwrites updatedAt to the return time — revisionSubmittedAt must survive this
    const returnedAgain = memoReducer(afterFirst, {
      type: "RETURN_MEMO", id: revBase.id, returnReason: "ยังขาดเอกสาร", updatedAt: "03 Jun 2026 14:00",
    });
    // Second resubmit — snapshot of Rev.1 must show "02 Jun 09:00" (when Rev.1 was submitted), not "03 Jun 14:00" (return time)
    const afterSecond = memoReducer(returnedAgain, {
      type: "RESUBMIT_MEMO", id: revBase.id, updatedAt: "04 Jun 2026 10:00",
    });
    expect(afterSecond[0].revisions![1].submittedAt).toBe("02 Jun 2026 09:00");
    expect(afterSecond[0].revisions![1].submittedAt).not.toBe("03 Jun 2026 14:00");
  });
});

describe("memoReducer — SKIP_ALL_READS", () => {
  const withMixed: MemoRecord = {
    ...seedMemos[0],
    status: "pending",
    readActions: [
      { recipient: "HR&GA", status: "read", actedAt: "28 May 2026 09:00" },
      { recipient: "IT", status: "pending" },
      { recipient: "ACC/FIN", status: "pending" },
    ],
    updatedAt: "28 May 2026 10:00",
  };
  const other: MemoRecord = { ...seedMemos[1] };

  it("marks all pending recipients as skipped and stores skipReason", () => {
    const next = memoReducer([withMixed], { type: "SKIP_ALL_READS", id: withMixed.id, skipReason: "ฉุกเฉิน", actedAt: "28 May 2026 12:00" });
    const reads = next[0].readActions!;
    expect(reads.find((r) => r.recipient === "IT")).toMatchObject({ status: "skipped", skipReason: "ฉุกเฉิน" });
    expect(reads.find((r) => r.recipient === "ACC/FIN")).toMatchObject({ status: "skipped", skipReason: "ฉุกเฉิน" });
  });

  it("does not overwrite already-read entries", () => {
    const next = memoReducer([withMixed], { type: "SKIP_ALL_READS", id: withMixed.id, skipReason: "ฉุกเฉิน" });
    expect(next[0].readActions!.find((r) => r.recipient === "HR&GA")).toEqual({ recipient: "HR&GA", status: "read", actedAt: "28 May 2026 09:00" });
  });

  it("stamps actedAt on skipped entries when provided", () => {
    const next = memoReducer([withMixed], { type: "SKIP_ALL_READS", id: withMixed.id, skipReason: "test", actedAt: "28 May 2026 12:00" });
    expect(next[0].readActions!.find((r) => r.recipient === "IT")!.actedAt).toBe("28 May 2026 12:00");
  });

  it("leaves non-pending memos unchanged", () => {
    const approved: MemoRecord = { ...withMixed, status: "approved" };
    const next = memoReducer([approved], { type: "SKIP_ALL_READS", id: approved.id, skipReason: "test" });
    expect(next[0]).toEqual(approved);
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer([withMixed, other], { type: "SKIP_ALL_READS", id: withMixed.id, skipReason: "test" });
    expect(next.find((m) => m.id === other.id)).toEqual(other);
  });
});

describe("memoReducer — SUBMIT_REVISION", () => {
  const revBase: MemoRecord = {
    id: "EM-2026-SVREV",
    title: "Original Title",
    requester: "Test User",
    department: "IT",
    category: "general-purchase",
    amount: 5000,
    status: "returned",
    currentStep: "Manager / Top Section",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    returnReason: "เอกสารไม่ครบ",
    cycleHours: 0,
    createdAt: "01 Jun 2026 10:00",
    updatedAt: "02 Jun 2026 14:00",
  };

  const basePayload = {
    type: "SUBMIT_REVISION" as const,
    id: revBase.id,
    title: "Updated Title",
    category: "service-contract" as const,
    department: "HR&GA",
    amount: 8000,
    description: "Updated description",
    budgetStatus: "in-budget" as const,
    selectedRoute: ["Manager / Top Section"] as const,
    updatedAt: "03 Jun 2026 09:00",
  };

  it("sets status to pending and increments revisionNo from returned status", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].status).toBe("pending");
    expect(result[0].revisionNo).toBe(1);
  });

  it("applies new content fields to the live memo", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].title).toBe("Updated Title");
    expect(result[0].category).toBe("service-contract");
    expect(result[0].department).toBe("HR&GA");
    expect(result[0].amount).toBe(8000);
    expect(result[0].description).toBe("Updated description");
  });

  it("snapshot captures OLD content before the revision edits", () => {
    const result = memoReducer([revBase], basePayload);
    const snap = result[0].revisions![0].snapshot;
    expect(snap.title).toBe("Original Title");
    expect(snap.category).toBe("general-purchase");
    expect(snap.amount).toBe(5000);
    expect(snap.department).toBe("IT");
  });

  it("resets currentStep to first step of the new selectedRoute", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].currentStep).toBe("Manager / Top Section");
  });

  it("sets workflowState to Issued", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].workflowState).toBe("Issued");
  });

  it("clears returnReason, rejectReason, rejectDisposition from live record", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].returnReason).toBeUndefined();
    expect(result[0].rejectReason).toBeUndefined();
    expect(result[0].rejectDisposition).toBeUndefined();
  });

  it("preserves returnReason in the revision snapshot entry", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].revisions![0].returnReason).toBe("เอกสารไม่ครบ");
  });

  it("sets revision source to 'return' for returned memo", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].revisions![0].source).toBe("return");
  });

  it("works from rejected+revision-allowed with correct source and rejectReason in snapshot", () => {
    const rejected: MemoRecord = {
      ...revBase,
      status: "rejected",
      rejectDisposition: "revision-allowed",
      rejectReason: "ราคาเกินวงเงิน",
      returnReason: undefined,
    };
    const result = memoReducer([rejected], { ...basePayload, id: rejected.id });
    expect(result[0].status).toBe("pending");
    expect(result[0].revisions![0].source).toBe("rejection-allowed");
    expect(result[0].revisions![0].rejectReason).toBe("ราคาเกินวงเงิน");
    expect(result[0].revisions![0].returnReason).toBeUndefined();
  });

  it("does NOT apply revision to pending memos — memo stays unchanged", () => {
    const pending: MemoRecord = { ...revBase, status: "pending", returnReason: undefined };
    const result = memoReducer([pending], basePayload);
    expect(result[0].title).toBe("Original Title");
    expect(result[0].revisionNo).toBeUndefined();
    expect(result[0].revisions).toBeUndefined();
  });

  it("does NOT apply revision to rejected+close memos", () => {
    const closed: MemoRecord = { ...revBase, status: "rejected", rejectDisposition: "close" };
    const result = memoReducer([closed], basePayload);
    expect(result[0].title).toBe("Original Title");
    expect(result[0].revisions).toBeUndefined();
  });

  it("snapshot submittedAt uses createdAt of the memo being revised", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].revisions![0].submittedAt).toBe("01 Jun 2026 10:00");
  });

  it("sets revisionSubmittedAt to the dispatch updatedAt for the next revision cycle", () => {
    const result = memoReducer([revBase], basePayload);
    expect(result[0].revisionSubmittedAt).toBe("03 Jun 2026 09:00");
  });

  it("leaves other memos unchanged", () => {
    const other: MemoRecord = { ...seedMemos[1] };
    const result = memoReducer([revBase, other], basePayload);
    expect(result.find((m) => m.id === other.id)).toEqual(other);
  });
});

describe("buildMemoSnapshot", () => {
  const richMemo: MemoRecord = {
    id: "EM-2026-SNAP",
    title: "Snapshot Test Memo",
    requester: "ผู้ทดสอบ",
    department: "IT",
    category: "general-purchase",
    amount: 15000,
    status: "returned",
    currentStep: "General Manager",
    workflowState: "Checked",
    cycleHours: 4,
    createdAt: "01 Jun 2026 10:00",
    updatedAt: "02 Jun 2026 14:00",
    selectedRoute: ["Manager / Top Section", "General Manager"],
    readRecipients: ["ACC/FIN", "HR&GA"],
    returnReason: "ต้องแก้ไขงบประมาณ",
    rejectReason: undefined,
    description: "รายละเอียดคำขอ",
    budgetStatus: "in-budget",
    routeMode: "recommended",
    notifyMD: false,
    revisionNo: 1,
  };

  it("includes submitted content fields: title, amount, category, selectedRoute, readRecipients", () => {
    const snap = buildMemoSnapshot(richMemo);

    expect(snap.title).toBe("Snapshot Test Memo");
    expect(snap.amount).toBe(15000);
    expect(snap.category).toBe("general-purchase");
    expect(snap.selectedRoute).toEqual(["Manager / Top Section", "General Manager"]);
    expect(snap.readRecipients).toEqual(["ACC/FIN", "HR&GA"]);
  });

  it("includes routing and budget fields when present", () => {
    const snap = buildMemoSnapshot(richMemo);

    expect(snap.department).toBe("IT");
    expect(snap.description).toBe("รายละเอียดคำขอ");
    expect(snap.budgetStatus).toBe("in-budget");
    expect(snap.routeMode).toBe("recommended");
    expect(snap.notifyMD).toBe(false);
  });

  it("does not include workflow execution fields: status, currentStep, workflowState", () => {
    const snap = buildMemoSnapshot(richMemo) as Record<string, unknown>;

    expect("status" in snap).toBe(false);
    expect("currentStep" in snap).toBe(false);
    expect("workflowState" in snap).toBe(false);
  });

  it("does not include return/reject reason fields or identity/timing fields", () => {
    const snap = buildMemoSnapshot(richMemo) as Record<string, unknown>;

    expect("returnReason" in snap).toBe(false);
    expect("rejectReason" in snap).toBe(false);
    expect("id" in snap).toBe(false);
    expect("requester" in snap).toBe(false);
    expect("updatedAt" in snap).toBe(false);
    expect("createdAt" in snap).toBe(false);
    expect("revisionNo" in snap).toBe(false);
    expect("cycleHours" in snap).toBe(false);
  });

  it("snapshot built from prevMemo is unchanged by RESUBMIT_MEMO applying to same memo", () => {
    const returnedMemo: MemoRecord = { ...richMemo };
    const snapBefore = buildMemoSnapshot(returnedMemo);
    const nextState = memoReducer([returnedMemo], { type: "RESUBMIT_MEMO", id: returnedMemo.id, updatedAt: "03 Jun 2026 09:00" });
    const snapAfter = buildMemoSnapshot(returnedMemo);

    // Snapshot is derived from prevMemo; reducer mutation on nextState does not affect it
    expect(snapBefore).toEqual(snapAfter);
    // nextState clears returnReason from the live record, but our snapshot never had it
    expect(nextState[0].returnReason).toBeUndefined();
    expect("returnReason" in snapBefore).toBe(false);
  });
});

describe("memoReducer — DELETE_MEMO (soft-delete)", () => {
  const state = seedMemos.slice(0, 3);
  const target = state[1];
  const ts = "05 Jun 2026 14:30";

  it("soft-deletes by setting deletedAt instead of removing the row", () => {
    const next = memoReducer(state, { type: "DELETE_MEMO", id: target.id, deletedAt: ts });
    expect(next.length).toBe(state.length);
    const voided = next.find(m => m.id === target.id)!;
    expect(voided.deletedAt).toBe(ts);
    expect(voided.updatedAt).toBe(ts);
  });

  it("leaves other memos unchanged and active", () => {
    const next = memoReducer(state, { type: "DELETE_MEMO", id: target.id, deletedAt: ts });
    expect(next.find(m => m.id === state[0].id)!.deletedAt).toBeUndefined();
    expect(next.find(m => m.id === state[2].id)!.deletedAt).toBeUndefined();
  });

  it("is a no-op for an unknown id", () => {
    const next = memoReducer(state, { type: "DELETE_MEMO", id: "EM-DOES-NOT-EXIST", deletedAt: ts });
    expect(next.every(m => !m.deletedAt)).toBe(true);
  });
});

describe("memoReducer — RESTORE_MEMO", () => {
  const voided = { ...seedMemos[0], deletedAt: "05 Jun 2026 14:30" };
  const state = [voided, seedMemos[1]];

  it("clears deletedAt and stamps updatedAt", () => {
    const next = memoReducer(state, { type: "RESTORE_MEMO", id: voided.id, updatedAt: "06 Jun 2026 09:00" });
    const restored = next.find(m => m.id === voided.id)!;
    expect(restored.deletedAt).toBeUndefined();
    expect(restored.updatedAt).toBe("06 Jun 2026 09:00");
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer(state, { type: "RESTORE_MEMO", id: voided.id, updatedAt: "06 Jun 2026 09:00" });
    expect(next.find(m => m.id === seedMemos[1].id)).toEqual(seedMemos[1]);
  });
});

describe("memoReducer — DESTROY_MEMO", () => {
  const state = seedMemos.slice(0, 3);
  const target = state[1];

  it("permanently removes the memo from state", () => {
    const next = memoReducer(state, { type: "DESTROY_MEMO", id: target.id });
    expect(next).toHaveLength(state.length - 1);
    expect(next.find(m => m.id === target.id)).toBeUndefined();
  });

  it("leaves other memos unchanged", () => {
    const next = memoReducer(state, { type: "DESTROY_MEMO", id: target.id });
    expect(next.find(m => m.id === state[0].id)).toEqual(state[0]);
    expect(next.find(m => m.id === state[2].id)).toEqual(state[2]);
  });

  it("is a no-op for an unknown id", () => {
    const next = memoReducer(state, { type: "DESTROY_MEMO", id: "EM-DOES-NOT-EXIST" });
    expect(next).toEqual(state);
  });
});
