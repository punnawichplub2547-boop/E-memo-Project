# AI Draft Preview — Show Closing Remark — Design Spec

- **Date:** 2026-07-09
- **Status:** Approved by คุณพลับ (chat, 2026-07-09)
- **Scope:** `src/app/create/_components/DraftPreviewPanel.tsx` + its call site in `src/app/create/page.tsx`

## Goal

The "AI Draft Preview" tab in the create-memo assistant panel does not currently show the text the user typed into the separate "หมายเหตุ / Closing Remark" tab. It should, appended as the final block of the document mockup, so the preview reflects the full memo the user is about to submit.

## Behavior

1. **Live sync, no new state.** `closingRemark` already lives in `page.tsx` (state backing the `ClosingRemarkCard` tab) and is passed straight through as a new prop to `DraftPreviewPanel`. All three assistant tabs (`routing`/`draft`/`remark`) are mounted simultaneously and only toggled via CSS (`em-create-tab-pane` + `data-tab`), so typing in the remark tab updates the draft preview immediately — no extra sync logic needed.
2. **Hidden when empty.** If `closingRemark.trim()` is empty, the block renders nothing — matches the existing pattern used for the optional request-items table.
3. **Divider + label when present.** When non-empty, render (as the last block inside the document mockup, after the request-items table or description paragraph, whichever is last): a `<hr className="em-divider">`, a "หมายเหตุ" section header styled like the existing "รายการที่ขออนุมัติ:" header, then the remark text.
4. **Multi-line safe.** The remark `<textarea>` is 180px tall and invites multi-line input; the rendered paragraph uses `whiteSpace: "pre-wrap"` so line breaks the user typed are preserved instead of being collapsed.
5. **Mobile-safe.** `wordBreak: "break-word"` guards against a long unbroken string (e.g. a URL) overflowing the box on narrow viewports. No new media query — the block inherits the same font-size/line-height as the rest of the preview text, which already behaves responsively under the existing `768px` breakpoint.

## Architecture

| Unit | Change |
|---|---|
| `DraftPreviewPanelProps` | add `closingRemark: string` |
| `DraftPreviewPanel` render | append the conditional divider+label+paragraph block described above, after the existing request-items table JSX |
| `page.tsx` (~line 895-911) | pass `closingRemark={closingRemark}` at the existing `<DraftPreviewPanel ... />` call |

## Testing & Verification

- Pure presentational change (JSX/props only) — no `lib/*.ts` business-rule logic touched, so no new unit tests required per CLAUDE.md's test-when-changing-business-rules rule.
- Gate: `npm.cmd run lint`, `npm.cmd run build` green.
- Manual/browser verification: type a multi-line remark, confirm it appears at the bottom of the "AI Draft Preview" tab with divider+label, confirm the block is fully absent when the field is empty, and check a mobile viewport width for wrapping/overflow.

## Out of Scope

- Any change to `ClosingRemarkCard` itself or how the remark is persisted/submitted (`closingRemark` submit logic already exists, untouched).
- Any change to the request-items table or other existing preview sections.
