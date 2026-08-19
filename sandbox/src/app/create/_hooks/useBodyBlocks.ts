"use client";

import { useCallback, useState } from "react";
import {
  createBlock,
  moveBlock,
  removeBlock,
  hasSystemBlock,
  type MemoBodyBlock,
  type MemoFormMode,
  type SystemBlockRef,
} from "@/lib/memo-body-blocks";

export type UseBodyBlocksResult = {
  formMode: MemoFormMode;
  setFormMode: (mode: MemoFormMode) => void;
  blocks: MemoBodyBlock[];
  setBlocks: (blocks: MemoBodyBlock[]) => void;
  addBlock: (type: MemoBodyBlock["type"], ref?: SystemBlockRef) => void;
  updateBlock: (id: string, patch: Partial<MemoBodyBlock>) => void;
  removeBlockById: (id: string) => void;
  moveBlockBy: (id: string, direction: -1 | 1) => void;
  isSystemBlockUsed: (ref: SystemBlockRef) => boolean;
};

export function useBodyBlocks(initial?: {
  formMode?: MemoFormMode;
  blocks?: MemoBodyBlock[];
}): UseBodyBlocksResult {
  const [formMode, setFormModeState] = useState<MemoFormMode>(initial?.formMode ?? "standard");
  const [blocks, setBlocks] = useState<MemoBodyBlock[]>(initial?.blocks ?? []);

  // Switching back to the standard form must not leave orphaned blocks behind —
  // the server-side validator rejects a "standard" memo that still carries
  // bodyBlocks, so the client has to agree with that rule at the source.
  const setFormMode = useCallback((mode: MemoFormMode) => {
    setFormModeState(mode);
    if (mode === "standard") setBlocks([]);
  }, []);

  const addBlock = useCallback((type: MemoBodyBlock["type"], ref?: SystemBlockRef) => {
    setBlocks((current) => [...current, createBlock(type, ref)]);
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<MemoBodyBlock>) => {
    setBlocks((current) =>
      current.map((block) =>
        // Partial<MemoBodyBlock> can carry a field from a different block-type
        // arm (e.g. { text } while block is a "table"), which the discriminated
        // union technically forbids. Callers only ever patch a block with a
        // partial of its own shape (the brief's own test spreads `{ text }` onto
        // a paragraph); the cast is the one place that trade-off is paid instead
        // of forcing every call site to prove the type narrows.
        block.id === id ? ({ ...block, ...patch } as MemoBodyBlock) : block
      )
    );
  }, []);

  const removeBlockById = useCallback((id: string) => {
    setBlocks((current) => removeBlock(current, id));
  }, []);

  const moveBlockBy = useCallback((id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const from = current.findIndex((block) => block.id === id);
      return from < 0 ? current : moveBlock(current, from, from + direction);
    });
  }, []);

  const isSystemBlockUsed = useCallback(
    (ref: SystemBlockRef) => hasSystemBlock(blocks, ref),
    [blocks]
  );

  return {
    formMode,
    setFormMode,
    blocks,
    setBlocks,
    addBlock,
    updateBlock,
    removeBlockById,
    moveBlockBy,
    isSystemBlockUsed,
  };
}
