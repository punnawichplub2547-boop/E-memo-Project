# Workflow Route Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flexible approval routing that defaults to Book1 stair-step recommendations while requiring an audit reason for skipped or lower-than-recommended routes.

**Architecture:** Keep business rules in `sandbox/src/lib/approval.ts`, with pure helpers for recommended routes and route analysis. Store selected route metadata on `MemoRecord`, then render the selected route and exception reason in Create, Queue, and History views.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest.

---

### Task 1: Approval Route Helpers

**Files:**
- Modify: `sandbox/src/lib/approval.test.ts`
- Modify: `sandbox/src/lib/approval.ts`

- [ ] Add failing tests for `analyzeApprovalRoute`:

```ts
expect(analyzeApprovalRoute("Managing Director", ["Manager / Top Section", "General Manager", "Managing Director"])).toMatchObject({
  mode: "recommended",
  requiresReason: false
});
expect(analyzeApprovalRoute("Managing Director", ["Manager / Top Section", "Managing Director"])).toMatchObject({
  mode: "exception",
  requiresReason: true
});
expect(analyzeApprovalRoute("General Manager", ["Manager / Top Section"])).toMatchObject({
  mode: "exception",
  requiresReason: true
});
expect(analyzeApprovalRoute("General Manager", ["Manager / Top Section", "General Manager", "Managing Director"])).toMatchObject({
  mode: "escalated",
  requiresReason: false
});
```

- [ ] Run `npm.cmd test` in `sandbox/` and confirm the tests fail because `analyzeApprovalRoute` is missing.
- [ ] Add `ApprovalRouteMode`, `WorkflowState`, route fields on `MemoRecord`, and pure helpers in `approval.ts`.
- [ ] Run `npm.cmd test` and confirm all tests pass.

### Task 2: Create Page Route UI

**Files:**
- Modify: `sandbox/src/app/create/page.tsx`

- [ ] Use `buildApprovalFlow(recommendation.recommendedFinalApprover)` for the recommended stair route.
- [ ] Let users toggle the GM step when MD is recommended and pick the final approver.
- [ ] Show selected route, route mode badge, and a required reason textarea when `requiresReason` is true.
- [ ] Save route metadata to `ADD_MEMO`.

### Task 3: Queue and History Display

**Files:**
- Modify: `sandbox/src/app/queue/page.tsx`
- Modify: `sandbox/src/app/history/page.tsx`

- [ ] Show selected route summary instead of implying MD always means `>50,000 THB`.
- [ ] Show `Route exception` and override reason when present.
- [ ] Keep existing table and drawer density; no new database/auth/email behavior.

### Task 4: Verify

**Files:**
- Read-only verification for changed code.

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Fix any failures without broad unrelated refactors.
