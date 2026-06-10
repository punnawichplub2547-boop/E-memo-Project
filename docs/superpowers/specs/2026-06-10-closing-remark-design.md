# Closing Remark (หมายเหตุ) Field — Design Spec

**Date:** 2026-06-10
**Status:** Approved

## Summary

Add an optional "หมายเหตุ / Remarks" field at the very bottom of the E-Memo create form. The field lets the requester leave a closing note (e.g. "กรุณาพิจารณาอนุมัติด้วย") separate from the main description. It is displayed at the bottom of the memo view in the queue drawer.

---

## Data Model

**`MemoRecord`** (`src/lib/approval.ts`):
```ts
closingRemark?: string;   // optional, no max length enforced
```

**`MemoSnapshot`** (`src/lib/approval.ts`) — same field added so revision history captures it:
```ts
closingRemark?: string;
```

**`buildMemoSnapshot`** (`src/lib/memo-store.tsx`) — include `closingRemark: m.closingRemark`.

---

## Create Form

### New component: `src/app/create/_components/RemarksCard.tsx`

- Card heading: **หมายเหตุ / Remarks**
- Sub-label: "บันทึกเพิ่มเติมท้าย Memo (ถ้ามี)"
- Single `<textarea>` — optional, no `*` required marker
- `minHeight: 100px` (shorter than description's 160px — closing notes are brief)
- No AI integration, no writing hints

### Placement in `create/page.tsx`

Last item inside the `em-form-rows` lower section, after `PriceComparisonCard`:

```
RequestItemsCard
Budget + Attachments (2-col)
PriceComparisonCard
RemarksCard          ← new, full-width
```

### State

```ts
const [closingRemark, setClosingRemark] = useState("");
```

Included in the submit payload for both `ADD_MEMO` (new) and `SUBMIT_REVISION` (edit-resubmit).
`RESUBMIT_MEMO` (quick resubmit) preserves existing `closingRemark` unchanged — snapshots it before reset.

---

## Queue Drawer

File: `src/app/queue/_components/drawer-panel.tsx`

Render after the **Attachments** section and before the **Approval Route / Workflow timeline**:

```
Summary
Description
Request Items
Budget
Price Comparison
Book1 Flags
Read Recipients / Actions
Attachments
หมายเหตุ             ← new, only shown when closingRemark has a value
Approval Route / Timeline
```

Section hidden entirely when `closingRemark` is empty/undefined — no empty box shown.

---

## Database

**Migration file:** `db/migrations/2026-06-10-add-closing-remark.sql`

```sql
ALTER TABLE memos ADD COLUMN closing_remark TEXT NULL AFTER description;
```

**API — write** (`POST /api/memos`, `SUBMIT_REVISION` persist path):
- Read `closingRemark` from request body, write to `closing_remark` column.

**API — read** (`GET /api/memos`, `GET /api/memos/[id]`):
- Map `closing_remark` → `closingRemark` in the returned `MemoRecord`.

---

## Memo Store

`src/lib/memo-store.tsx` — actions that need `closingRemark`:

| Action | Change |
|---|---|
| `ADD_MEMO` | Accept `closingRemark` in payload, persist to DB. |
| `SUBMIT_REVISION` | Accept `closingRemark` in edited payload, overwrite on resubmit. |
| `RESUBMIT_MEMO` | Snapshot includes `closingRemark`; field value carried forward unchanged. |
| All others | No change needed. |

---

## Out of Scope

- Character limit / validation — not needed for prototype.
- AI draft integration — closing remark is manual only.
- PDF output — deferred to future print feature.
- Revision-mode field editing — follows same rule as attachments: field is editable in `SUBMIT_REVISION` (edit-and-resubmit via `/create?revise=`).
