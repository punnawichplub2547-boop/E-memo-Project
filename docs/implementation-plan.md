# HR&GA E-Memo Sandbox Implementation Plan

> For agentic workers: continue from the current sandbox instead of recreating the project.

## Goal

Create a first-pass web app sandbox that turns the Excel requirement into a working Next.js 16 + React 19 prototype and leaves enough documentation for Codex and Claude to continue safely.

## Architecture

The first version is a frontend-only sandbox. Business rules live in `sandbox/src/lib/approval.ts`, UI lives in `sandbox/src/components/ememo-dashboard.tsx`, and requirements live in `docs/requirements-from-excel.md`.

## Tasks

- [x] Extract workbook requirements into a Markdown summary.
- [x] Scaffold Next.js 16 + React 19 sandbox.
- [x] Add tests for approval routing and dashboard metrics.
- [x] Implement approval matrix and seed memo data.
- [x] Build primary dashboard UI with memo draft, approval queue, workflow status, and AI search.
- [x] Add `AGENTS.md` and `CLAUDE.md` for future agent context.
- [ ] Add persistence, authentication, and real AI/email integrations in later phases.

## Next Technical Steps

1. Add a `MemoDraft` domain model and form validation.
2. Add route-level pages for `/memos/new`, `/memos/[id]`, `/approvals`, and `/search`.
3. Add a database layer after choosing storage.
4. Add role-based access for requester, manager, GM, MD, and admin.
5. Add a real email notification provider.
6. Add AI draft/search through an approved internal API.
