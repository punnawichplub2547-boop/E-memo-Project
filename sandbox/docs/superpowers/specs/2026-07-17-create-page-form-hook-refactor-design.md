# Create Page Form Hook Refactor — Design

Status: approved by คุณพลับ (sections 1+2), spec written 2026-07-17

## Why

`sandbox/src/app/create/page.tsx` tripped the `D:\Hrproject\CLAUDE.md` guardrail
— *"file >700 lines + new behavior → extract first or include a split plan"* —
twice. It was already 1,028 lines at the 2026-07-08 clean-code audit, which
flagged: *"Pending refactor: Extract `useCreateMemoForm` hook when next
behavior change lands in `create/page.tsx`."* The Memo Template feature
(`fe40fb5`, 2026-07-15) then landed as exactly that next behavior change but
added +187 lines straight into the file instead of extracting first. The file
is now **1,209 lines**.

This refactor is a pure extraction: move existing logic out of `page.tsx` into
focused hooks with no visual or behavioral change.

## Key constraint: zero existing test coverage

`create/page.tsx` has **no automated test coverage today** — no `.test.tsx`
files under `src/app/create/`, and this repo has no Playwright/e2e. The
project's "tests green" safety net is entirely `lib/*.ts` pure-function unit
tests (`approval.ts`, `workflow-rules.ts`, etc.) — none render or exercise
this page. Keeping the test suite green is necessary but **not sufficient**
proof this refactor is behavior-preserving. Manual browser smoke-testing is
the real safety net for the JSX/wiring layer; new hook-level unit tests cover
the logic layer.

## Section 1 — Hook split (approach B: four focused hooks)

Rejected: one giant `useCreateMemoForm` mega-hook (approach A) — คุณพลับ
explicitly chose the four-hook split after seeing the trade-offs.

New files under `src/app/create/_hooks/`, alongside the existing
`useCreateMemoAssistant.ts`:

| Hook | Owns | Inputs | Key outputs |
|---|---|---|---|
| `useMemoFormFields.ts` | All 20+ form field states, revision-mode lazy-init prefill, all derived/computed values (recommendation, selectedRoute, routeReview, budgetRemaining, vendor summaries, etc.), request-item/vendor-row add/remove/update helpers | `{ memos, reviseId, user }` | every field + setter, derived values, and `applyBulkData()` — a shared bulk-setter used by both template-load and AI/PDF prefill |
| `useMemoTemplates.ts` | Template fetch/load/save/delete (`/api/templates`) | `{ isRevisionMode, applyBulkData, snapshotFormData }` | `templates`, `templatesLoading`, `saveModalOpen`, `handleLoadTemplate`/`Save`/`Delete` |
| `useMemoAiAssist.ts` | AI draft suggest (`/api/ai-draft`) + PDF quote extract (`/api/pdf-extract`) | `{ category, amount, department, budgetStatus, priceComparisons, requestItems, applyBulkData }` | `isAiLoading`/`aiError`, `isPdfLoading`/`pdfError`, `pdfInputRef`, `handleAiSuggest`, `handlePdfUpload` |
| `useMemoSubmit.ts` | Attachment upload + `handleSubmit` (draft / pending / revision — 3 paths) | the full return object of `useMemoFormFields` + `{ user, dispatch, router }` | `attachmentFiles`/`Error`, `isSubmitting`, `addAttachmentFiles`, `removeAttachmentFile`, `handleSubmit` |

**Design intent:** `applyBulkData()` lives inside `useMemoFormFields` — the
only hook that knows individual field names — and is the single entry point
both `useMemoTemplates` and `useMemoAiAssist` call to write data back into the
form. Neither of those two hooks needs to know field internals, only the data
shape. This mirrors the existing `handleLoadTemplate` field-by-field
presence-check logic almost exactly.

`page.tsx` after refactor: composes all 5 hooks (4 new + existing
`useCreateMemoAssistant`), wires the exact same props into the exact same
untouched `_components/*` files, same JSX/markup/CSS.

## Section 2 — Testing strategy

- **`useMemoFormFields`**: revision-mode prefill correctness, derived-value
  recompute on category/amount change, edge cases in `removeVendorRow` /
  `removeRequestItem` (reassigning `isSelected`, refusing to go to 0 rows).
  Almost no fetch mocking needed.
- **`useMemoTemplates`**: fetch skipped in revision mode, `handleLoadTemplate`
  calls `applyBulkData` with the right shape + toast, save/delete
  success/error branches. Mock `fetch`.
- **`useMemoAiAssist`**: every existing error branch for both AI draft and PDF
  extract (`not_configured` / `quota_exceeded` / `parse_error` / generic), PDF
  merge logic (replace-if-first-row-blank vs append). Mock `fetch`.
- **`useMemoSubmit`**: draft/pending/revision submit paths, validation
  short-circuit, attachment-upload-failure aborts before dispatch. Mock
  `fetch`, `dispatch`, `router.push`.
- **Manual smoke test required regardless** (no e2e exists in this repo)
  before calling the work done, covering 6 flows:
  1. New memo → submit
  2. Template load / save / delete
  3. AI draft suggest
  4. PDF extract prefill
  5. Attach file → submit
  6. `/create?revise=<id>` → resubmit

## Out of scope

- No visual or markup changes to any `_components/*` file.
- No new features or behavior changes — this is a pure extraction.
- `useCreateMemoAssistant.ts` is not touched or folded into the new hooks.
- No changes to API routes, DB schema, or approval rules.
- Revision-impact routing, attachment editing in revision mode, and other
  known gaps listed in `D:\Hrproject\CLAUDE.md` are unaffected and unchanged.

## Next step

Implementation plan via `superpowers:writing-plans`, then hand off per
คุณพลับ's earlier instruction: **เท่ง** (architect) for the plan/spec pass,
**โหน่ง** (builder) for the TDD implementation.
