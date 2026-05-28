"use client";

import React, { createContext, useContext, useReducer } from "react";
import { seedMemos, MemoRecord, MemoStatus, ApprovalLevel, ReadAction } from "./approval";

type Action =
  | { type: "ADD_MEMO"; memo: MemoRecord }
  | { type: "UPDATE_STATUS"; id: string; status: MemoStatus; updatedAt?: string }
  | { type: "UPDATE_STEP"; id: string; step: ApprovalLevel; updatedAt?: string }
  | { type: "ADVANCE_STEP"; id: string; updatedAt?: string }
  | { type: "MARK_READ"; id: string; recipient: string; actedAt?: string }
  | { type: "SKIP_ALL_READS"; id: string; skipReason: string; actedAt?: string }
  | { type: "RETURN_MEMO"; id: string; returnReason: string; updatedAt?: string }
  | { type: "RESUBMIT_MEMO"; id: string; revisionNote?: string; updatedAt?: string };

export function memoReducer(state: MemoRecord[], action: Action): MemoRecord[] {
  switch (action.type) {
    case "ADD_MEMO":
      return [action.memo, ...state];
    case "UPDATE_STATUS":
      return state.map((m) =>
        m.id === action.id ? { ...m, status: action.status, updatedAt: action.updatedAt ?? m.updatedAt } : m
      );
    case "UPDATE_STEP":
      return state.map((m) =>
        m.id === action.id ? { ...m, currentStep: action.step, updatedAt: action.updatedAt ?? m.updatedAt } : m
      );
    case "ADVANCE_STEP": {
      return state.map((m) => {
        if (m.id !== action.id || m.status !== "pending") return m;
        const route = m.selectedRoute;
        const idx = route ? route.indexOf(m.currentStep) : -1;
        const isLastOrMissing = !route || route.length === 0 || idx === -1 || idx === route.length - 1;
        if (isLastOrMissing) {
          return { ...m, status: "approved", workflowState: "Approved", updatedAt: action.updatedAt ?? m.updatedAt };
        }
        return { ...m, currentStep: route[idx + 1], workflowState: "Checked", updatedAt: action.updatedAt ?? m.updatedAt };
      });
    }
    case "MARK_READ": {
      return state.map((m) => {
        if (m.id !== action.id || m.status !== "pending" || !m.readActions) return m;
        return {
          ...m,
          readActions: m.readActions.map((ra) =>
            ra.recipient === action.recipient
              ? { ...ra, status: "read" as const, actedAt: action.actedAt ?? ra.actedAt }
              : ra
          ),
        };
      });
    }
    case "SKIP_ALL_READS": {
      return state.map((m) => {
        if (m.id !== action.id || m.status !== "pending" || !m.readActions) return m;
        return {
          ...m,
          readActions: m.readActions.map((ra) =>
            ra.status === "pending"
              ? { ...ra, status: "skipped" as const, skipReason: action.skipReason, actedAt: action.actedAt ?? ra.actedAt }
              : ra
          ),
        };
      });
    }
    case "RETURN_MEMO":
      return state.map((m) =>
        m.id === action.id ? { ...m, status: "returned", returnReason: action.returnReason, updatedAt: action.updatedAt ?? m.updatedAt } : m
      );
    case "RESUBMIT_MEMO":
      return state.map((m) =>
        m.id === action.id
          ? {
              ...m,
              status: "pending",
              currentStep: m.selectedRoute?.[0] ?? "Manager / Top Section",
              workflowState: "Issued",
              revisionNote: action.revisionNote,
              updatedAt: action.updatedAt ?? m.updatedAt,
              readActions: m.readActions?.map((ra): ReadAction => ({ recipient: ra.recipient, status: "pending" })),
            }
          : m
      );
    default:
      return state;
  }
}

interface MemoContextValue {
  memos: MemoRecord[];
  dispatch: React.Dispatch<Action>;
}

const MemoContext = createContext<MemoContextValue | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, dispatch] = useReducer(memoReducer, seedMemos);
  return (
    <MemoContext.Provider value={{ memos, dispatch }}>
      {children}
    </MemoContext.Provider>
  );
}

export function useMemos() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error("useMemos must be used within MemoProvider");
  return ctx;
}
