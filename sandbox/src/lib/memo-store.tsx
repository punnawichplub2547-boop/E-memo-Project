"use client";

import React, { createContext, useContext, useReducer } from "react";
import { seedMemos, MemoRecord, MemoStatus, ApprovalLevel } from "./approval";

type Action =
  | { type: "ADD_MEMO"; memo: MemoRecord }
  | { type: "UPDATE_STATUS"; id: string; status: MemoStatus }
  | { type: "UPDATE_STEP"; id: string; step: ApprovalLevel };

function memoReducer(state: MemoRecord[], action: Action): MemoRecord[] {
  switch (action.type) {
    case "ADD_MEMO":
      return [action.memo, ...state];
    case "UPDATE_STATUS":
      return state.map((m) =>
        m.id === action.id ? { ...m, status: action.status } : m
      );
    case "UPDATE_STEP":
      return state.map((m) =>
        m.id === action.id ? { ...m, currentStep: action.step } : m
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
