"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { seedMemos, MemoRecord } from "./approval";
import { memoReducer, buildMemoSnapshot, type MemoAction } from "./memo-reducer";
import { memoToDbSeedRow } from "./db-seed";
import { memoPersistErrorMessage } from "./memo-persist-error";
import { showErrorToast } from "./toast";
import { allowSeedFallbackOnDbError } from "./seed-fallback";
import { usePrototypeUser } from "./prototype-user-context";
import type {
  AdvanceStepBody,
  MarkReadBody,
  RejectMemoBody,
  ResubmitMemoBody,
  ReturnMemoBody,
  SkipAllReadsBody,
  SoftDeleteMemoBody,
  SubmitRevisionBody,
} from "./db-memo-write";

export { memoReducer, buildMemoSnapshot };
export type { MemoAction };

interface MemoContextValue {
  /** Active memos only (soft-deleted rows filtered out). Use this in all normal views. */
  memos: MemoRecord[];
  /** Every memo including soft-deleted ones. Use only where deleted rows must be visible (admin). */
  allMemos: MemoRecord[];
  dispatch: React.Dispatch<MemoAction>;
  /** True once the initial DB hydration fetch has settled (success or network failure). */
  hydrated: boolean;
}

const MemoContext = createContext<MemoContextValue | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, reducerDispatch] = useReducer(memoReducer, seedMemos);
  const [hydrated, setHydrated] = useState(false);
  const { user } = usePrototypeUser();
  const actorName = user.name;
  const dispatch = useCallback<React.Dispatch<MemoAction>>((action) => {
    if (action.type === "ADVANCE_STEP") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistAdvanceStep(action.id, prevMemo, nextMemo, actorName, action.updatedAt);
      }
    } else if (action.type === "RETURN_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistReturnMemo(action.id, prevMemo, nextMemo, action.returnReason, actorName, action.updatedAt, action.returnToStep);
      }
    } else if (action.type === "REVIEW_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistReviewMemo(action.id, action.response, action.comment, action.reason);
      }
    } else if (action.type === "REJECT_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistRejectMemo(action.id, prevMemo, nextMemo, action.disposition, action.reason, actorName, action.updatedAt);
      }
    } else if (action.type === "RESUBMIT_MEMO") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistResubmitMemo(action.id, prevMemo, nextMemo, action.revisionNote, actorName, action.updatedAt);
      }
    } else if (action.type === "SUBMIT_REVISION") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        void persistSubmitRevisionMemo(action.id, prevMemo, nextMemo, action.revisionNote, actorName);
      }
    } else if (action.type === "MARK_READ") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      const nextReadAction = nextMemo?.readActions?.find((ra) => ra.recipient === action.recipient);
      if (prevMemo && nextMemo && prevMemo !== nextMemo && nextReadAction?.status === "read") {
        void persistMarkRead(action.id, nextMemo, action.recipient, action.actedAt ?? nextReadAction.actedAt ?? nextMemo.updatedAt, actorName);
      }
    } else if (action.type === "SKIP_ALL_READS") {
      const prevState = memos;
      const nextState = memoReducer(prevState, action);
      reducerDispatch(action);
      const prevMemo = prevState.find((m) => m.id === action.id);
      const nextMemo = nextState.find((m) => m.id === action.id);
      if (prevMemo && nextMemo && prevMemo !== nextMemo) {
        const skippedRecipients = prevMemo.readActions
          ?.filter((ra) => ra.status === "pending")
          .map((ra) => ra.recipient) ?? [];
        if (skippedRecipients.length === 0) return;
        const actedAt = action.actedAt ??
          nextMemo.readActions?.find((ra) => ra.status === "skipped" && skippedRecipients.includes(ra.recipient))?.actedAt ??
          nextMemo.updatedAt;
        void persistSkipAllReads(action.id, nextMemo, skippedRecipients, action.skipReason, actedAt, actorName);
      }
    } else if (action.type === "DELETE_MEMO") {
      const nextMemo = memos.find((m) => m.id === action.id);
      reducerDispatch(action);
      if (nextMemo) void persistSoftDeleteMemo(action.id, nextMemo.revisionNo ?? 0, action.deletedAt, actorName);
    } else if (action.type === "RESTORE_MEMO") {
      const nextMemo = memos.find((m) => m.id === action.id);
      reducerDispatch(action);
      if (nextMemo) void persistRestoreMemo(action.id, nextMemo.revisionNo ?? 0, action.updatedAt, actorName);
    } else if (action.type === "DESTROY_MEMO") {
      const targetMemo = memos.find((m) => m.id === action.id);
      reducerDispatch(action);
      if (targetMemo) void persistDestroyMemo(action.id);
    } else {
      reducerDispatch(action);
      if (action.type === "ADD_MEMO") {
        void persistNewMemo(action.memo);
      }
    }
  }, [memos, actorName]);
  useEffect(() => {
    let cancelled = false;
    async function hydrateMemos() {
      try {
        const response = await fetch("/api/memos", { cache: "no-store" });
        if (response.status === 401 || response.status === 403) {
          // Auth failure — must not expose seed/demo data to unauthorized sessions.
          if (!cancelled) reducerDispatch({ type: "HYDRATE_MEMOS", memos: [] });
          return;
        }
        if (!response.ok) {
          // 5xx / unexpected — seedMemos fallback is a dev convenience only;
          // production shows an empty workspace instead of demo data.
          if (!cancelled && !allowSeedFallbackOnDbError(process.env.NODE_ENV)) {
            reducerDispatch({ type: "HYDRATE_MEMOS", memos: [] });
          }
          return;
        }
        const dbMemos = await response.json() as MemoRecord[];
        if (!cancelled && Array.isArray(dbMemos)) {
          reducerDispatch({ type: "HYDRATE_MEMOS", memos: dbMemos });
        }
      } catch {
        // Network error or DB unavailable — keep seedMemos in dev only (see above).
        if (!cancelled && !allowSeedFallbackOnDbError(process.env.NODE_ENV)) {
          reducerDispatch({ type: "HYDRATE_MEMOS", memos: [] });
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    void hydrateMemos();
    return () => {
      cancelled = true;
    };
  }, []);
  // Active list excludes soft-deleted memos. The reducer keeps the full list internally so
  // dispatch/persist closures still resolve voided rows by id; we filter only at the boundary.
  const activeMemos = useMemo(() => memos.filter((m) => !m.deletedAt), [memos]);
  return (
    <MemoContext.Provider value={{ memos: activeMemos, allMemos: memos, dispatch, hydrated }}>
      {children}
    </MemoContext.Provider>
  );
}

async function persistAdvanceStep(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  actorName: string,
  updatedAt?: string,
) {
  const body: AdvanceStepBody = {
    stepLabel: prev.currentStep,
    nextCurrentStep: next.currentStep,
    nextStatus: next.status,
    nextWorkflowState: next.workflowState ?? "Checked",
    revisionNo: next.revisionNo ?? 0,
    updatedAt: updatedAt ?? next.updatedAt,
    actorName,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] ADVANCE_STEP persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] ADVANCE_STEP persist failed", error);
  }
}

async function persistReturnMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  returnReason: string,
  actorName: string,
  updatedAt?: string,
  returnToStep?: string,
) {
  const body: ReturnMemoBody = {
    stepLabel: prev.currentStep,
    returnReason,
    returnToStep,
    revisionNo: next.revisionNo ?? 0,
    updatedAt: updatedAt ?? next.updatedAt,
    actorName,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] RETURN_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] RETURN_MEMO persist failed", error);
  }
}

async function persistReviewMemo(
  memoId: string,
  response: "acknowledged_no_objection" | "comment" | "request_revision" | "escalate_to_md_approval",
  comment: string | undefined,
  reason: string | undefined,
) {
  try {
    const response_ = await fetch(`/api/memos/${encodeURIComponent(memoId)}/md-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response, comment, reason }),
    });
    if (!response_.ok) {
      console.error("[MemoProvider] REVIEW_MEMO persist failed", response_.status, await response_.text());
    }
  } catch (error) {
    console.error("[MemoProvider] REVIEW_MEMO persist failed", error);
  }
}

async function persistResubmitMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  revisionNote: string | undefined,
  actorName: string,
  updatedAt?: string,
) {
  const body: ResubmitMemoBody = {
    oldRevisionNo: prev.revisionNo ?? 0,
    source: prev.status === "returned" ? "return" : "rejection-allowed",
    returnReason: prev.returnReason ?? null,
    rejectReason: prev.rejectReason ?? null,
    revisionNote: revisionNote ?? null,
    oldSubmittedAt: prev.revisionSubmittedAt ?? prev.createdAt,
    snapshotJson: JSON.stringify(buildMemoSnapshot(prev)),
    nextCurrentStep: next.currentStep,
    readRecipients: prev.readActions?.map((ra) => ra.recipient) ?? [],
    updatedAt: updatedAt ?? next.updatedAt,
    actorName,
    // Server overrides this from the DB row (trust boundary) — sent here only to
    // satisfy the request body shape.
    requiresMdReview: next.requiresMdReview ?? false,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/resubmit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] RESUBMIT_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] RESUBMIT_MEMO persist failed", error);
  }
}

async function persistSubmitRevisionMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  revisionNote: string | undefined,
  actorName: string,
) {
  const body: SubmitRevisionBody = {
    oldRevisionNo: prev.revisionNo ?? 0,
    source: prev.status === "returned" ? "return" : "rejection-allowed",
    returnReason: prev.returnReason ?? null,
    rejectReason: prev.rejectReason ?? null,
    revisionNote: revisionNote ?? null,
    // prev used here: old submitted-at timestamp for the revision archive entry
    oldSubmittedAt: prev.revisionSubmittedAt ?? prev.createdAt,
    // prev used here: snapshot of OLD content — must NOT use next
    snapshotJson: JSON.stringify(buildMemoSnapshot(prev)),
    // next used here: full updated live row with new form content already applied
    nextMemoRow: memoToDbSeedRow(next),
    readRecipients: next.readActions?.map((ra) => ra.recipient) ??
                    next.readRecipients ??
                    [],
    actorName,
    // Per-person route: send ids only and let the server rebuild the tokens and
    // the name snapshot against the users table (same trust boundary as POST
    // /api/memos). Omitting this is not neutral — the route handler reads its
    // absence as "Book1 route" and clears custom_route_json, which would quietly
    // convert a per-person memo back to a level route on every resubmit.
    customRoute: next.customRoute?.map((a) => ({ userId: a.userId })),
    // V3 free-form body: also not neutral to omit. The route handler treats a
    // missing formMode/bodyBlocks as "resend your blocks" for a free-form memo
    // and hard-400s rather than falling back to what is already stored (see
    // SubmitRevisionBody's comment in db-memo-write.ts) — so this must always
    // carry the reducer's already-applied next.formMode/next.bodyBlocks, same
    // as customRoute above.
    formMode: next.formMode,
    bodyBlocks: next.bodyBlocks,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/submit-revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] SUBMIT_REVISION persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] SUBMIT_REVISION persist failed", error);
  }
}

async function persistRejectMemo(
  memoId: string,
  prev: MemoRecord,
  next: MemoRecord,
  disposition: "close" | "revision-allowed",
  rejectReason: string,
  actorName: string,
  updatedAt?: string,
) {
  const body: RejectMemoBody = {
    stepLabel: prev.currentStep,
    disposition,
    rejectReason,
    revisionNo: next.revisionNo ?? 0,
    updatedAt: updatedAt ?? next.updatedAt,
    actorName,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] REJECT_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] REJECT_MEMO persist failed", error);
  }
}

async function persistMarkRead(
  memoId: string,
  next: MemoRecord,
  recipient: string,
  actedAt: string,
  actorName: string,
) {
  const body: MarkReadBody = {
    recipient,
    revisionNo: next.revisionNo ?? 0,
    actedAt,
    actorName,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] MARK_READ persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] MARK_READ persist failed", error);
  }
}

async function persistSkipAllReads(
  memoId: string,
  next: MemoRecord,
  recipients: string[],
  skipReason: string,
  actedAt: string,
  actorName: string,
) {
  const body: SkipAllReadsBody = {
    recipients,
    skipReason,
    revisionNo: next.revisionNo ?? 0,
    actedAt,
    actorName,
  };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/skip-reads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] SKIP_ALL_READS persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] SKIP_ALL_READS persist failed", error);
  }
}

// Soft-delete (void): sets memos.deleted_at in the DB and appends a "void" audit row.
// The memo and its full audit trail are preserved; RESTORE_MEMO reverses it.
// On a legacy DB that predates the deleted_at migration the UPDATE returns 500 — the local
// reducer already flagged the memo, so the prototype stays usable in seed-fallback mode.
async function persistSoftDeleteMemo(memoId: string, revisionNo: number, deletedAt: string, actorName: string) {
  const body: SoftDeleteMemoBody = { revisionNo, deletedAt, actorName, reason: null };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] DELETE_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] DELETE_MEMO persist failed", error);
  }
}

async function persistRestoreMemo(memoId: string, revisionNo: number, updatedAt: string, actorName: string) {
  const body: SoftDeleteMemoBody = { revisionNo, deletedAt: updatedAt, actorName, reason: null };
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] RESTORE_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] RESTORE_MEMO persist failed", error);
  }
}

async function persistDestroyMemo(memoId: string) {
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/destroy`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      console.error("[MemoProvider] DESTROY_MEMO persist failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[MemoProvider] DESTROY_MEMO persist failed", error);
  }
}

async function persistNewMemo(memo: MemoRecord) {
  try {
    const response = await fetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memo),
    });
    if (!response.ok && response.status !== 409) {
      const body = await response.json().catch(() => null);
      console.error("[MemoProvider] Failed to persist memo", response.status, body);
      const message = memoPersistErrorMessage(response.status, body);
      // Without this the memo looks sent while nothing was stored — e.g. a custom
      // route naming an approver who was deactivated before submit (400).
      if (message) showErrorToast(message, 8000);
    }
  } catch (error) {
    console.error("[MemoProvider] Failed to persist memo", error);
    showErrorToast("บันทึกเมโมไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง", 8000);
  }
}

export function useMemos() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("useMemos must be used within MemoProvider");
  return ctx;
}
