# Design Spec: Three Backlog Features
**Date:** 2026-06-11  
**Status:** Approved by user

---

## Feature 1 — Closing Remark (หมายเหตุ)

### Summary
Add an optional free-text closing remark field to memos. DB column (`closing_remark`) and TypeScript types (`closingRemark?: string` on `MemoSnapshot` and `MemoRecord`) are already present. Only the UI and DB mapper are missing.

### Changes

**`src/lib/db-memos.ts`** — `rowToMemoRecord()` is missing the mapping. Add:
```ts
closingRemark: optional(row.closing_remark),
```

**`src/app/create/_components/ClosingRemarkCard.tsx`** — New component. Single optional `<textarea>` labeled **หมายเหตุ / Closing Remark**. Props: `value: string`, `onChange: (v: string) => void`.

**`src/app/create/page.tsx`** — Add `closingRemark` state (default `""`). Render `<ClosingRemarkCard>` after `<AttachmentsCard>`. Include `closingRemark` in the memo payload on submit (both `ADD_MEMO` and `SUBMIT_REVISION`). Verify the API route also saves it.

**`src/app/queue/_components/drawer-panel.tsx`** — In the Summary section, render closing remark below the description block, only when `memo.closingRemark` is truthy. Label: **หมายเหตุ**.

**API route** — Verify `POST /api/memos` and `PATCH /api/memos/[id]` already read `closingRemark` from the request body and write `closing_remark` to the DB. Fix if missing.

### Impact
- No existing tests touch `closingRemark` — no breakage expected.
- The DB column already exists; no migration needed.

---

## Feature 2 — Monthly Report (`/report`)

### Summary
New dedicated page at `/report` showing memo activity for a selected month. Access restricted to admin, manager, general-manager, and managing-director roles.

### Data API — `GET /api/report?month=YYYY-MM`
Queries `memos` table (non-deleted only: `deleted_at IS NULL`) filtered by `created_at` in the given month.

Returns:
```json
{
  "month": "2026-06",
  "total": 12,
  "byStatus": { "pending": 3, "approved": 6, "rejected": 1, "returned": 1, "draft": 1 },
  "byDepartment": [
    { "department": "IT", "submitted": 3, "approved": 2, "rejected": 0, "budgetTotal": 45000 }
  ]
}
```
`budgetTotal` = sum of `budget_used` (falling back to `budget_plan` when `budget_used` is null).

### Page — `src/app/report/page.tsx`
- Role gate: redirect to `/` if session role is not in `["admin","manager","general-manager","managing-director"]`.
- Month navigator: `← [Month Year] →` header. Defaults to current month. State: `selectedMonth: string` (YYYY-MM).
- KPI row: **Total Memos · Approved · Rejected** (three cards).
- **By Status** section: simple labeled count rows for all 5 statuses.
- **By Department** table: Department | Submitted | Approved | Rejected | Budget Total (฿).
- Loading skeleton while fetching. Empty state if no memos for that month.

### Sidebar
Add **Monthly Report** link (icon: `IconChart` or `IconHistory`) under the Workflow section, visible only to the same roles. Sidebar already has the role/auth pattern to follow.

### Impact
- New route `/report` is automatically protected by `src/middleware.ts` (JWT check applies to all non-public routes).
- No changes to existing routes or data models.
- Need to add a chart/report icon to `src/components/icons.tsx` if not present.

---

## Feature 3 — CC-Only Visibility Fix

### Summary
The current `isMemoVisibleTo()` CC check is gated on `session.roles.includes("read-recipient")`. This means a user with only the `requester` role who is explicitly CC'd on another memo cannot see it. Fix: make CC membership check role-independent.

### Change — `src/lib/memo-visibility.ts`

**Before (lines 47–56):**
```ts
if (session.roles.includes("read-recipient")) {
  const labels = new Set<string>(...)
  if (recipients.some(r => labels.has(r))) return true;
}
return false;
```

**After:**
```ts
// Any user explicitly CC'd on a memo can see it — no role required
const labels = new Set<string>(
  [fullName, session.department, session.email].filter((s): s is string => Boolean(s))
);
const recipients: string[] = [
  ...(memo.readRecipients ?? []),
  ...(memo.readActions?.map(ra => ra.recipient) ?? []),
];
if (recipients.some(r => labels.has(r))) return true;
return false;
```

The `read-recipient` role itself is not removed — it may still be used elsewhere (prototype action permissions). Only the visibility gate is loosened.

### Impact on tests
`memo-visibility.test.ts` has 35 tests. Tests that assert a `read-recipient`-role user can see a CC'd memo will still pass. Tests that assert a non-`read-recipient` user **cannot** see a CC'd memo will now fail and must be updated to reflect the new rule (CC is role-independent).

### Impact on other systems
- `canApproveMemo()` in `prototype-users.ts` is separate from visibility — unaffected.
- Queue action routes (approve/reject/return) rely on middleware JWT only — unaffected.
- Admin visibility (returns `true` at line 26) — unaffected.
- Requester, approver, MD rules — unaffected (no deletions).

---

## Implementation Order
1. Feature 1 (Closing Remark) — smallest, entirely additive.
2. Feature 3 (CC visibility fix) — surgical change + test updates.
3. Feature 2 (Monthly Report) — largest new surface, but fully isolated.
