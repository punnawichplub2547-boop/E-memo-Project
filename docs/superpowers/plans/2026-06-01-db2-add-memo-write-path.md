# DB-2 ADD_MEMO Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist newly created memos from the existing `ADD_MEMO` flow into MySQL while keeping all other workflow mutations in-memory.

**Architecture:** Add a narrow `POST /api/memos` write path that accepts the existing `MemoRecord` shape. The route writes one `memos` row, one `workflow_step_actions` row (`submit` or `save_draft`), and current-revision `read_actions` rows inside a transaction. `MemoProvider` keeps optimistic reducer behavior and fire-and-forgets persistence for `ADD_MEMO`.

**Tech Stack:** Next.js route handlers, React reducer context, MySQL 8 via `mysql2`, Vitest.

---

### Task 1: Write Mapper Tests

**Files:**
- Create: `sandbox/src/lib/db-memo-write.test.ts`
- Create/modify: `sandbox/src/lib/db-memo-write.ts`

- [ ] Write failing tests for building workflow action rows and read action rows from a `MemoRecord`.
- [ ] Verify they fail because `db-memo-write.ts` does not exist.
- [ ] Implement minimal helper functions.
- [ ] Verify targeted tests pass.

### Task 2: POST /api/memos

**Files:**
- Modify: `sandbox/src/app/api/memos/route.ts`
- Use: `sandbox/src/lib/db-memo-write.ts`

- [ ] Add `POST` handler accepting a `MemoRecord`.
- [ ] Insert into `memos`, `workflow_step_actions`, and `read_actions` in one transaction.
- [ ] Return `201` with `{ id: memo.id }`.
- [ ] Return `409` on duplicate `memo_no`.

### Task 3: Optimistic Client Persistence

**Files:**
- Modify: `sandbox/src/lib/memo-store.tsx`

- [ ] Replace raw reducer dispatch in `MemoProvider` with a wrapper dispatch.
- [ ] Keep immediate reducer update for every action.
- [ ] For `ADD_MEMO`, POST the memo to `/api/memos` in the background.
- [ ] Log persistence failure without breaking prototype UI.

### Task 4: Verification

**Commands:**
- `npm.cmd test`
- `npm.cmd run lint`
- `npm.cmd run build`
- Runtime POST/GET smoke check against `http://localhost:3000/api/memos`

**Expected:** tests pass, build includes `/api/memos`, POST creates a memo row, GET returns it with `id` as the memo number.
