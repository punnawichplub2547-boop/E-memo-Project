# Design — Excel form preview from the create page

**Date:** 2026-08-06
**Status:** approved by คุณพลับ, ready for implementation

## Problem

The F-DC-006 Excel form can only be produced from `/queue`, after a memo has been
submitted. A requester filling in `/create` cannot see what the paper-equivalent
form will look like until the memo is already in the workflow — too late to fix a
layout or content mistake without a revision cycle.

## Goal

A button on `/create` that downloads the same `.xlsx` the queue produces, built
from whatever is currently in the form, without saving anything.

## Why this is small

`src/lib/export/memo-excel.ts:392`:

```ts
export async function memoToExcelBuffer(
  memo: MemoRecord,
  signatures: MemoSignature[] = [],
): Promise<Buffer>
```

The generator is already a pure function of a `MemoRecord`. The database appears
only in `loadMemoForExport()` (a separate file) whose sole job is to turn a DB row
into that `MemoRecord`. Supply the record from another source and the same file
comes out.

`useMemoSubmit.ts:154-188` already assembles exactly such a record from the form —
it is just inlined inside `handleSubmit`, so nothing else can reach it.

**Verified before design (2026-08-06):** `memoToExcelBuffer` was called with a bare
draft record (blank `id`, empty `requestItems`/`priceComparisons`/`selectedRoute`),
with a record missing every optional field, and with a filled Thai-text record. All
three produced a valid, re-openable workbook. No hardening of the generator is
needed.

## Architecture

```
[/create form]
      │  fields (useMemoFormFields)
      ▼
buildMemoDraftRecord(input) -> MemoRecord        NEW, pure
      │
      ├─────► dispatch ADD_MEMO / SUBMIT_REVISION      existing path
      └─────► POST /api/memos/preview-excel            NEW
                      │  memoToExcelBuffer(memo, [])   existing, untouched
                      ▼
                 .xlsx download
```

**Invariant:** the previewed form and the queue's form come from the same
`memoToExcelBuffer()`. A second generator must never be written — that is how the
two silently drift apart (see ERR-0030).

## Components

### 1. `src/lib/build-memo-draft-record.ts` (new)

`buildMemoDraftRecord(input): MemoRecord` — pure, no side effects, no I/O.

Lifts the 37-field record assembly out of `useMemoSubmit.handleSubmit`. Both the
real submit path and the preview call it, so the preview can never show fields the
submit does not send, or vice versa. This removes duplication that already exists
between the `ADD_MEMO` and `SUBMIT_REVISION` payloads.

### 2. `src/app/api/memos/preview-excel/route.ts` (new)

`POST` — body `{ memo: MemoRecord }`, returns `200` with the `.xlsx` bytes.

- Session guard via `getActiveSessionUserFromToken` (defence in depth; middleware
  already blocks anonymous requests).
- No database access, no disk writes, no persistence.
- `signatures: []` — nothing is approved yet.

### 3. `/create` button

Ghost button **"ดูตัวอย่างฟอร์ม Excel"** in the footer action bar
(`create/page.tsx:508`), plus `handlePreviewExcel()`.

**Not in the topbar.** `globals.css:1608-1611` hides non-primary topbar buttons
below 768px, so a button placed there would be invisible on every phone. (The same
rule already hides "Save Template" on mobile — measured at 0px wide on 320/360/390/430.
That is a pre-existing gap, out of scope here.)

## Decisions

| Question | Decision |
|---|---|
| When is the button enabled? | Always. It does not run `validateMemoFormForApproval` — a preview that refuses to open when the form is incomplete cannot help you find what is missing, and the file goes to nobody. |
| Output | Download `.xlsx`. No on-screen preview (would need the form drawn twice and the two would drift). |
| Draft watermark | **None.** คุณพลับ decided the file should be identical to the real one. Recorded consequence: a printed draft cannot be told apart from a submitted memo by the document alone. |
| Ref.No | Blank. `memo-excel.ts:204` writes `memo.id` into Ref.No; passing `""` leaves the cell empty, like an unnumbered paper form. **Never call `generateMemoId()`** — it is timestamp-derived, so a preview number would not match the number issued at submit. |
| Revision mode (`?revise=`) | Button present. Uses the existing `reviseMemo.id` for Ref.No, since that memo already has a number. |
| Filename | `memo-draft.xlsx`; in revision mode `memo-<id>.xlsx`, matching the queue. |

## Mobile layout (required part of this change)

The footer action bar is inline-styled `display:flex` / `justify-content:flex-end`
with **no `flex-wrap`**, and both buttons carry `minWidth` (120 + 160 + 12 gap =
292px). Measured room inside the card:

| viewport | room | left after two buttons |
|---|---|---|
| 320 | 298px | **6px — `Save Draft` sits at `left: -7`, already clipped by the card edge** |
| 360 | 338px | 46px |
| 390 | 368px | 76px |
| 430 | 404px | 112px |

A third button does not fit at any phone width, and the bar is already broken at
320px today. The generic overflow check (`scrollWidth > clientWidth`) reports
nothing, because `justify-content: flex-end` pushes the overflow off the **start**
edge, which is not scrollable overflow — the defect is only visible by reading each
button's `left`, or by looking at a screenshot.

So this change also makes the bar responsive, following the pattern the project
already uses: move the inline values into a CSS class unchanged, then override
inside the existing `@media (max-width: 768px)` block.

```
desktop (unchanged)              phone <=768px (new)
+---------------------------+    +----------------------+
| [Excel] [Draft] [Send >]  |    | [ Send to Approval ] |  primary, full width
+---------------------------+    | [Draft]    [ Excel ] |  secondaries, half each
      right-aligned, one row     +----------------------+
```

- `flex-wrap: wrap`; primary `flex: 1 1 100%`; secondaries `flex: 1 1 calc(50% - 6px)`;
  `min-width` dropped on phones.
- At 320px each secondary gets ~143px — fits, and the existing clipping is fixed.
- Desktop >=769px is byte-identical to today: the same values, moved from `style=`
  to a class.

## Error handling

| Case | Behaviour |
|---|---|
| No session | `401` |
| Body is not a memo object | `400` |
| `requestItems` or `priceComparisons` longer than 200 rows | `400` — bounds the CPU a logged-in user can spend on one request |
| Generator throws | `500` + `console.error`, same shape as the queue export route |
| Fetch fails client-side | `showErrorToast`; the form is not cleared and the page does not navigate |

## Testing

- `build-memo-draft-record.test.ts` — record assembly; empty request-item rows
  dropped; `effective*` flags land in the right fields; revision mode keeps the
  existing id.
- `preview-excel/route.test.ts` — 401 without a session; 400 on a malformed body
  and on an over-length array; 200 returns the spreadsheet content type; **asserts
  no DB function is called**.
- A draft record round-trips through `memoToExcelBuffer` and re-opens as a valid
  workbook (promotes the throwaway probe into a permanent regression test).
- Regression: the six existing `useMemoSubmit` tests must stay green after the
  extraction — that is the evidence the real submit path did not change.
- Layout: button positions measured at 320/360/390/430/768/769/1440 **and**
  screenshots compared. The aggregate overflow number is not sufficient evidence
  here; it already gave a false pass once on this exact bar.

## Out of scope

On-screen preview; PDF; storing the file; touching the queue export route;
touching `memo-excel.ts`; the mobile "Save Template" gap.

## Size

Two new files, three edited (`useMemoSubmit.ts`, `create/page.tsx`, `globals.css`),
three test suites.

Two commits, in this order:

1. **Footer bar responsive fix** — a standalone bug fix for the 320px clipping,
   correct and verifiable with the two buttons that exist today. Landing it first
   means the feature commit does not have to carry an unrelated defect, and it can
   be reverted on its own.
2. **The preview feature** — the extraction, the route, and the third button, on
   top of a bar that already handles wrapping.
