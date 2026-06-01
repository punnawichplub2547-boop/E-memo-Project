# DB-1 Schema Plan — HR&GA E-Memo Online

**Status:** Pre-implementation planning — no database code written yet  
**Date:** 2026-06-01  
**Target database:** MySQL 8.x  
**Phase:** DB-1 (schema creation, seed data, read path only)  
**SA reference:** `docs/system-analysis-dfd-erd.md`

---

## 1. Purpose and Scope

DB-1 is the first persistence layer for the HR&GA E-Memo prototype. Its scope is deliberately limited:

- Create the MySQL schema for four focus tables
- Insert the eight seed memos from `seedMemos` in `approval.ts`
- Expose a read-path API that returns `MemoRecord`-shaped JSON to the existing frontend without requiring any frontend code changes

**DB-1 does NOT include:**

- Write persistence for any workflow mutation: `ADD_MEMO`, `ADVANCE_STEP`, `RETURN_MEMO`, `REJECT_MEMO`, `MARK_READ`, `SKIP_ALL_READS`, `RESUBMIT_MEMO`, `SUBMIT_REVISION`
- Authentication or real user records
- The `users`, `departments`, `roles`, `approval_rules`, or `notifications` tables from the SA
- Normalization of `requestItems` or `priceComparisons` into their own tables
- Real cycle time computation

Write persistence is DB-2. The prototype reducer and in-memory `MemoProvider` state remain the mutation layer during DB-1. The SA's Phase 2 roadmap is the governing design reference.

---

## 2. Current Prototype Data Model

All state lives in a `MemoRecord[]` array held in React's `useReducer` via `MemoProvider` in `memo-store.tsx`. All types are defined in `approval.ts`. The app resets to `seedMemos` on every page refresh.

### MemoRecord field clusters

**Identity and classification**

- `id` — the business memo number string, e.g. `EM-20260601-143022-4F7`. This is what the UI renders in tables, drawer headers, and URL params. It is not a surrogate database key.
- `title`, `requester` (display name string), `department` (name string)
- `category` — one of five `ApprovalCategory` values
- `amount`, `budgetStatus`, `accountCode`, `budgetPlan`, `budgetUsed`

**Workflow state**

- `status` — five values: `draft | pending | approved | rejected | returned`
- `workflowState` — `Issued | Checked | Read | Approved | Rejected`
- `currentStep` — `Manager / Top Section | General Manager | Managing Director`
- `cycleHours` — integer hours; hard-coded on seeds; intended to measure creation-to-completion time

**Approval routing**

- `recommendedFinalApprover`, `recommendedRoute[]`, `selectedRoute[]`
- `routeMode` — `recommended | escalated | exception`
- `routeOverrideReason`, `notifyMD`

**Read recipient tracking — two coexisting models**

- `readRecipients[]` — legacy plain string array, display-only; present on seed memos
- `readActions[]` — structured per-recipient tracking with `{ recipient, status, actedAt, skipReason }`; present on memos submitted after Stage 5A

**Return and reject**

- `returnReason`, `rejectReason`, `rejectDisposition` (`close | revision-allowed`)

**Revision tracking**

- `revisionNo` — current revision number, starts at 0, incremented on each resubmit
- `revisionSubmittedAt`, `revisionNote`
- `revisions[]` — array of `MemoRevision` snapshots, one per resubmit

**Book1 audit flags**

- `isPriceAdjustment`, `followsProductionPlan`, `isDeadStockOrSlowMovement`
- `departmentMonthlyOverBudgetTotal`

**Supporting data**

- `description`, `requestItems[]`, `priceComparisons[]`
- `selectedVendorId`, `selectedVendorReason`, `priceAdjustmentReason`

**Timestamps**

- `createdAt` — required; format `"DD Mon YYYY HH:MM"` in Bangkok local time
- `updatedAt` — required; same format

---

## 3. Key Design Decisions

### 3.1 Internal DB Primary Key vs Business Memo Number

The prototype's `MemoRecord.id` is the business memo number. It is stable, human-readable, and embedded throughout the UI. The database `memos` table uses a `BIGINT AUTO_INCREMENT` column as the internal primary key for efficient joins and foreign keys. The business number lives in a separate `memo_no` column.

**Critical constraint for DB-1:** The API read layer must map `memos.memo_no` to `MemoRecord.id` in every response. The BIGINT PK is never exposed to the frontend. The field name `id` in JSON responses always carries the `memo_no` value.

```
DB column:  memos.memo_no  →  JSON field: MemoRecord.id  (e.g. "EM-20260601-143022-4F7")
DB column:  memos.id       →  internal use only; never returned to frontend in DB-1
```

No frontend code changes are required. This mapping is the sole responsibility of the API response serializer. It must be covered by an integration test before DB-1 is considered complete.

### 3.2 Timestamp Storage Policy

All `DATETIME` columns in the database store UTC.

Seed memo timestamps are written in Bangkok local time (`"DD Mon YYYY HH:MM"`, UTC+7). The seed migration script must interpret them as Bangkok time and insert UTC. Example:

```
Prototype:   "17 May 2026 17:00"  (Bangkok local, UTC+7)
DB insert:   2026-05-17 10:00:00  (UTC)
```

The API read layer converts UTC datetimes back to Bangkok display strings using `Intl.DateTimeFormat` with `timeZone: "Asia/Bangkok"` and `formatToParts`, following the same pattern as `format-timestamp.ts`. The canonical output format remains `"DD Mon YYYY HH:MM"`.

### 3.3 read_actions: Scoping by revision_no Instead of is_current

Current read actions are identified by matching `read_actions.revision_no` to `memos.revision_no`. No `is_current` boolean flag is introduced in DB-1 because it would create an additional sync point during resubmit: every resubmit would need to locate and flip all existing `read_actions` rows to `is_current = FALSE` before inserting new ones, and any failure in that flip produces silently incorrect state.

With `revision_no` scoping, the resubmit transaction sequence in DB-2 is:

1. Insert into `memo_revisions` using the current `memos.revision_no` (the old value).
2. Update `memos.revision_no = revision_no + 1` and reset other workflow fields.
3. Insert new `read_actions` rows using the new `memos.revision_no`.

Old `read_actions` rows from past revisions are never touched. They remain queryable for history.

To query current read actions for a memo:

```sql
SELECT ra.*
FROM read_actions ra
JOIN memos m ON ra.memo_id = m.id AND ra.revision_no = m.revision_no
WHERE m.id = ?
ORDER BY ra.id ASC;
```

### 3.4 cycle_hours Policy

`cycleHours` in the prototype is a hard-coded integer on seed memos. It is intended to measure total hours from memo creation to completion. `updated_at` must not be used to compute it because `updated_at` is stamped on every workflow event including intermediate approvals, returns, resubmits, and read actions — a naive `TIMESTAMPDIFF(HOUR, created_at, updated_at)` would overcount for memos that stalled, were returned, or are still pending.

In DB-1:

- The column is `INT NULL` on `memos`.
- Seed memos are inserted with their existing hard-coded values.
- New memos receive `NULL`.
- The API returns `cycle_hours ?? 0` to maintain frontend compatibility with the dashboard Avg. cycle KPI.

Real cycle time computation is deferred to Phase 3. It will be derived from `workflow_step_actions` terminal events: the gap between the `submit` row's `acted_at` and the final `approve` or `reject` row's `acted_at`.

### 3.5 JSON Columns vs Normalized Tables

DB-1 keeps the following as JSON columns on `memos`:

- `recommended_route_json` and `selected_route_json` — short arrays of known strings; no cross-memo filtering or per-element querying needed in DB-1
- `request_items_json` — items are display-only in DB-1; the `memo_items` table from SA §14.11 is deferred to Phase 3
- `price_comparisons_json` — tightly coupled to `selected_vendor_id`, which is an opaque string ID generated by `Date.now()` in the create form; normalizing to a separate table requires stable surrogate keys that do not yet exist
- `read_recipients_json` — legacy field for seed memos that have no `read_actions` rows; preserved for the drawer's legacy chip display path

`memo_revisions.snapshot_json` always stays JSON — it is a historical point-in-time freeze and is never queried field-by-field.

---

## 4. Focus Tables

### 4.1 memos

```sql
CREATE TABLE memos (
  id                              BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  -- Business memo number; maps to MemoRecord.id in all API responses.
  -- Never return the BIGINT id to the frontend in DB-1.
  memo_no                         VARCHAR(50)   NOT NULL,
  UNIQUE KEY uq_memo_no (memo_no),

  -- Core identity (denormalized strings; FK columns added in Phase 5 with auth)
  title                           VARCHAR(500)  NOT NULL,
  requester_name                  VARCHAR(255)  NOT NULL,
  department_name                 VARCHAR(100)  NOT NULL,
  category                        VARCHAR(80)   NOT NULL,
  -- raw-material | fixed-asset | service-contract | general-purchase | mold

  -- Amount and budget
  amount                          DECIMAL(15,2) NOT NULL,
  budget_status                   VARCHAR(50)   NULL,
  -- in-budget | over-budget | no-budget
  account_code                    VARCHAR(100)  NULL,
  budget_plan                     DECIMAL(15,2) NULL,
  budget_used                     DECIMAL(15,2) NULL,
  description                     TEXT          NULL,

  -- Workflow state
  status                          VARCHAR(50)   NOT NULL DEFAULT 'draft',
  -- draft | pending | approved | rejected | returned
  workflow_state                  VARCHAR(80)   NULL,
  -- Issued | Checked | Read | Approved | Rejected
  current_step                    VARCHAR(100)  NOT NULL,
  -- Manager / Top Section | General Manager | Managing Director

  -- Cycle time: nullable; seeded from prototype hard-coded values.
  -- Do not compute from updated_at. Real computation deferred to Phase 3
  -- via workflow_step_actions terminal events.
  cycle_hours                     INT           NULL,

  -- Approval routing
  recommended_final_approver      VARCHAR(100)  NULL,
  recommended_route_json          JSON          NULL,
  selected_route_json             JSON          NULL,
  route_mode                      VARCHAR(80)   NULL,
  -- recommended | escalated | exception
  route_override_reason           TEXT          NULL,
  notify_md                       BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Book1 audit flags
  is_price_adjustment             BOOLEAN       NOT NULL DEFAULT FALSE,
  follows_production_plan         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_dead_stock                   BOOLEAN       NOT NULL DEFAULT FALSE,
  dept_monthly_over_budget_total  DECIMAL(15,2) NULL,

  -- Return and reject
  return_reason                   TEXT          NULL,
  reject_reason                   TEXT          NULL,
  reject_disposition              VARCHAR(50)   NULL,
  -- close | revision-allowed

  -- Revision tracking (current revision number; drives read_actions scoping)
  revision_no                     INT           NOT NULL DEFAULT 0,
  revision_submitted_at           DATETIME      NULL,
  revision_note                   TEXT          NULL,

  -- Price comparison (JSON in DB-1; normalized to price_comparisons table in Phase 3)
  price_comparisons_json          JSON          NULL,
  selected_vendor_id              VARCHAR(100)  NULL,
  -- opaque string reference into price_comparisons_json;
  -- becomes INT FK when price_comparisons table is created in Phase 3
  selected_vendor_reason          TEXT          NULL,
  price_adjustment_reason         TEXT          NULL,

  -- Request items (JSON in DB-1; normalized to memo_items table in Phase 3)
  request_items_json              JSON          NULL,

  -- Legacy read recipient list (seed memos only; superseded by read_actions table)
  read_recipients_json            JSON          NULL,

  -- Timestamps stored as UTC; display layer converts to Asia/Bangkok
  created_at                      DATETIME      NOT NULL,
  updated_at                      DATETIME      NOT NULL,

  INDEX idx_memos_status          (status),
  INDEX idx_memos_current_step    (current_step),
  INDEX idx_memos_requester       (requester_name),
  INDEX idx_memos_department      (department_name),
  INDEX idx_memos_created_at      (created_at),
  INDEX idx_memos_id_revision     (id, revision_no)
);
```

### 4.2 memo_revisions

One row per resubmit event. Maps to the prototype's `MemoRevision` objects in `revisions[]`.

```sql
CREATE TABLE memo_revisions (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id           BIGINT       NOT NULL,
  CONSTRAINT fk_rev_memo FOREIGN KEY (memo_id) REFERENCES memos(id),

  -- The revision number BEFORE this resubmit.
  -- memos.revision_no will be revision_no + 1 after the resubmit completes.
  revision_no       INT          NOT NULL,

  source            VARCHAR(80)  NOT NULL,
  -- return | rejection-allowed

  return_reason     TEXT         NULL,
  -- populated when source = return
  reject_reason     TEXT         NULL,
  -- populated when source = rejection-allowed
  revision_note     TEXT         NULL,
  -- optional correction note from the requester

  -- Timestamp of the previous submission being superseded.
  -- Prototype fallback chain: revisionSubmittedAt ?? createdAt ?? updatedAt
  submitted_at      DATETIME     NOT NULL,

  -- Full MemoSnapshot frozen at resubmit time. Always JSON; never queried field-by-field.
  -- Contains: title, category, department, amount, description, budgetStatus,
  -- accountCode, budgetPlan, budgetUsed, requestItems[], priceComparisons[],
  -- selectedVendorId, selectedVendorReason, priceAdjustmentReason,
  -- isPriceAdjustment, followsProductionPlan, isDeadStockOrSlowMovement,
  -- departmentMonthlyOverBudgetTotal, readRecipients[], recommendedFinalApprover,
  -- recommendedRoute[], selectedRoute[], routeMode, routeOverrideReason, notifyMD
  snapshot_json     JSON         NOT NULL,

  -- NULL in DB-1. Future values: minor | approval-affecting (SA §6.8).
  revision_impact   VARCHAR(80)  NULL,

  created_at        DATETIME     NOT NULL,

  UNIQUE KEY uq_rev_memo_revision (memo_id, revision_no),
  INDEX idx_rev_memo_id (memo_id)
);
```

### 4.3 read_actions

One row per read recipient per revision. Current read actions for a memo are those whose `revision_no` matches `memos.revision_no`. No `is_current` flag is used.

```sql
CREATE TABLE read_actions (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id           BIGINT       NOT NULL,
  CONSTRAINT fk_ra_memo FOREIGN KEY (memo_id) REFERENCES memos(id),

  -- Scopes this row to a specific revision.
  -- Current rows always have revision_no = memos.revision_no for this memo.
  -- Past rows from earlier revisions retain their lower revision_no values.
  revision_no       INT          NOT NULL DEFAULT 0,

  -- Denormalized display name; FK to users.id added in Phase 5
  recipient_name    VARCHAR(255) NOT NULL,

  status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
  -- pending | read | skipped

  acted_at          DATETIME     NULL,
  skip_reason       TEXT         NULL,

  created_at        DATETIME     NOT NULL,
  updated_at        DATETIME     NOT NULL,

  UNIQUE KEY uq_ra_memo_revision_recipient (memo_id, revision_no, recipient_name),
  INDEX idx_ra_memo_revision (memo_id, revision_no)
);
```

To query current read actions for a given memo:

```sql
SELECT ra.*
FROM read_actions ra
JOIN memos m ON ra.memo_id = m.id AND ra.revision_no = m.revision_no
WHERE m.id = ?
ORDER BY ra.id ASC;
```

### 4.4 workflow_step_actions

Append-only event log. The prototype has no equivalent — state transitions are implicit in reducer dispatch. This table introduces an auditable record of every workflow event. In DB-1, only seed `submit` rows are inserted. Live action logging begins in DB-2.

```sql
CREATE TABLE workflow_step_actions (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id         BIGINT       NOT NULL,
  CONSTRAINT fk_wsa_memo FOREIGN KEY (memo_id) REFERENCES memos(id),

  -- Which revision of the memo this action occurred on
  revision_no     INT          NOT NULL DEFAULT 0,

  action_type     VARCHAR(80)  NOT NULL,
  -- submit | save_draft | check | read | skip_read
  -- approve | return_for_revision | reject | resubmit

  -- current_step value at action time; NULL for memo-level actions
  -- (submit, save_draft, resubmit have no specific step)
  step_label      VARCHAR(100) NULL,

  -- Denormalized actor name; FK to users.id added in Phase 5
  actor_name      VARCHAR(255) NULL,

  result          VARCHAR(100) NULL,
  -- approve:  "intermediate" | "final"
  -- reject:   "close" | "revision-allowed"
  -- resubmit: "quick" | "edit-and-resubmit"
  -- NULL for all other action types

  -- Return reason, reject reason, skip reason, or revision note as applicable
  reason          TEXT         NULL,

  -- Server timestamp at action time (UTC)
  acted_at        DATETIME     NOT NULL,

  -- Escape hatch for action-specific context without premature column widening.
  -- skip_read: includes affected recipient names
  -- read:      includes recipient name
  -- submit:    may include rule version snapshot in future
  metadata_json   JSON         NULL,

  INDEX idx_wsa_memo_id  (memo_id),
  INDEX idx_wsa_memo_rev (memo_id, revision_no),
  INDEX idx_wsa_acted_at (acted_at)
);
```

**Prototype reducer action to action_type mapping (for DB-2 write path reference):**

- `ADD_MEMO` with `status = "pending"` → `submit`, `step_label = NULL`
- `ADD_MEMO` with `status = "draft"` → `save_draft`, `step_label = NULL`
- `ADVANCE_STEP` to a non-final step → `check`, `result = "intermediate"`, `step_label = step before advance`
- `ADVANCE_STEP` to the final step → `approve`, `result = "final"`, `step_label = last step`
- `RETURN_MEMO` → `return_for_revision`, `reason = returnReason`
- `REJECT_MEMO` → `reject`, `result = disposition`, `reason = rejectReason`
- `MARK_READ` → `read`, recipient in `metadata_json`
- `SKIP_ALL_READS` → `skip_read`, `reason = skipReason`, recipients list in `metadata_json`
- `RESUBMIT_MEMO` → `resubmit`, `result = "quick"`, `reason = revisionNote`
- `SUBMIT_REVISION` → `resubmit`, `result = "edit-and-resubmit"`, `reason = revisionNote`

---

## 5. Field Mapping: MemoRecord to Database

The mapping below covers every `MemoRecord` field. Fields whose destination is `memos.*` populate the primary memo row. Fields whose destination names a separate table become rows in that table.

**Core identity**

- `id` → `memos.memo_no` (returned as `id` in all API responses — see §3.1)
- `title` → `memos.title`
- `requester` → `memos.requester_name`
- `department` → `memos.department_name`
- `category` → `memos.category`
- `amount` → `memos.amount`
- `budgetStatus` → `memos.budget_status`
- `accountCode` → `memos.account_code`
- `budgetPlan` → `memos.budget_plan`
- `budgetUsed` → `memos.budget_used`
- `description` → `memos.description`

**Workflow state**

- `status` → `memos.status`
- `workflowState` → `memos.workflow_state`
- `currentStep` → `memos.current_step`
- `cycleHours` → `memos.cycle_hours` (nullable; see §3.4)

**Approval routing**

- `recommendedFinalApprover` → `memos.recommended_final_approver`
- `recommendedRoute[]` → `memos.recommended_route_json` (JSON)
- `selectedRoute[]` → `memos.selected_route_json` (JSON)
- `routeMode` → `memos.route_mode`
- `routeOverrideReason` → `memos.route_override_reason`
- `notifyMD` → `memos.notify_md`

**Book1 audit flags**

- `isPriceAdjustment` → `memos.is_price_adjustment`
- `followsProductionPlan` → `memos.follows_production_plan`
- `isDeadStockOrSlowMovement` → `memos.is_dead_stock`
- `departmentMonthlyOverBudgetTotal` → `memos.dept_monthly_over_budget_total`

**Return and reject**

- `returnReason` → `memos.return_reason`
- `rejectReason` → `memos.reject_reason`
- `rejectDisposition` → `memos.reject_disposition`

**Revision tracking**

- `revisionNo` → `memos.revision_no`
- `revisionSubmittedAt` → `memos.revision_submitted_at`
- `revisionNote` → `memos.revision_note`

**Price comparison**

- `priceComparisons[]` → `memos.price_comparisons_json` (JSON in DB-1)
- `selectedVendorId` → `memos.selected_vendor_id`
- `selectedVendorReason` → `memos.selected_vendor_reason`
- `priceAdjustmentReason` → `memos.price_adjustment_reason`

**Request items**

- `requestItems[]` → `memos.request_items_json` (JSON in DB-1)

**Read recipients — two models**

- `readRecipients[]` → `memos.read_recipients_json` (JSON; legacy compat for seed memos)
- `readActions[]` → `read_actions` table, one row per recipient per revision

**Revision history**

- `revisions[]` → `memo_revisions` table, one row per resubmit event

**Timestamps**

- `createdAt` → `memos.created_at` (parsed from Bangkok local, stored as UTC)
- `updatedAt` → `memos.updated_at` (same)

---

## 6. Fields That Stay JSON in DB-1

- `memos.recommended_route_json` — 1–3 element string array; no cross-memo filtering needed
- `memos.selected_route_json` — same rationale
- `memos.request_items_json` — display-only in DB-1; `memo_items` table deferred to Phase 3
- `memos.price_comparisons_json` — `selected_vendor_id` is an opaque `Date.now()` string; normalizing requires stable surrogate keys not yet defined
- `memos.read_recipients_json` — legacy field for seed memos that have no `read_actions` rows; the drawer's chip fallback path reads this
- `memo_revisions.snapshot_json` — historical freeze; always JSON; never queried field-by-field
- `workflow_step_actions.metadata_json` — escape hatch for action-specific context

---

## 7. What Is Deferred

**Deferred to DB-2 (write path):**

- All write endpoints for workflow mutations listed in §1
- Populating `workflow_step_actions` from live user actions; only seed `submit` rows in DB-1
- The `read_actions` resubmit reset logic using `revision_no`

**Deferred to Phase 3 (workflow engine):**

- `workflow_steps` table (SA §14.15) and FK from `current_step` string to a step row
- Real cycle time from `workflow_step_actions` terminal event timestamps
- `memo_items` table; removes `request_items_json`
- `price_comparisons` table; removes `price_comparisons_json`; `selected_vendor_id` becomes INT FK

**Deferred to Phase 5 (authentication):**

- `users`, `departments`, `roles`, `user_roles`, `permissions`, `role_permissions` tables
- `requester_id BIGINT FK → users.id` replacing `requester_name`
- `department_id BIGINT FK → departments.id` replacing `department_name`
- `actor_user_id BIGINT FK → users.id` replacing `actor_name` in `workflow_step_actions`
- `recipient_user_id BIGINT FK → users.id` replacing `recipient_name` in `read_actions`

**Deferred indefinitely (pending business decision):**

- `revision_impact VARCHAR(80)` — column exists but always NULL; values `minor | approval-affecting` from SA §6.8 require the revision impact routing rule to be confirmed first

---

## 8. Seed Strategy

The eight seed memos (`EM-2026-001` through `EM-2026-008`) from `approval.ts` are inserted into `memos` by a migration script.

### Timestamp conversion

All seed `createdAt` and `updatedAt` values are Bangkok local time. The migration script parses them as UTC+7 before inserting UTC:

```
"17 May 2026 17:00"  (Bangkok)  →  2026-05-17 10:00:00  (UTC)
"18 May 2026 09:20"  (Bangkok)  →  2026-05-18 02:20:00  (UTC)
```

Validate each seed row's UTC value manually before running. A mistake produces timestamps 7 hours off and breaks the history page date-grouping logic.

### Seed memo characteristics

All eight seed memos:

- Have no `requestItems` → `request_items_json = NULL`
- Have no `priceComparisons` → `price_comparisons_json = NULL`
- Have no `readActions` → no `read_actions` rows; drawer uses `read_recipients_json` chip fallback
- Have no `revisions` → no `memo_revisions` rows
- Have absent `selectedRoute` on most records → `selected_route_json = NULL`
- Have absent `workflowState` on most records → infer: `pending → 'Issued'`, `approved → 'Approved'`, `rejected → 'Rejected'`
- Have hard-coded `cycleHours` → insert as-is into `cycle_hours`

### workflow_step_actions for seeds

Insert one row per seed memo: `action_type = 'submit'`, `acted_at = created_at` (UTC), `actor_name = NULL`, `step_label = NULL`. This gives the history page a baseline "Requester submitted" event for each seed memo. No check, read, or approve rows are inserted — the seeds' intermediate states are prototype artifacts not granular enough to reconstruct.

---

## 9. First Safe Implementation Slice

DB-1 is three discrete steps, each independently verifiable.

### Step 1 — Schema migration

Create the four tables in the MySQL instance defined by the Docker Compose files under `sandbox/`. The DB-1 schema is mounted into MySQL through `sandbox/db/init/001-db1-schema.sql`, which runs automatically only when the MySQL data volume is initialized for the first time. No application code changes are required for this step.

Verify:

```sql
SHOW TABLES;
-- Expected: memos, memo_revisions, read_actions, workflow_step_actions

DESCRIBE memos;
DESCRIBE memo_revisions;
DESCRIBE read_actions;
DESCRIBE workflow_step_actions;
```

### Step 2 — Seed migration

Run the seed script:

```bash
cd sandbox
npm.cmd run db:seed
```

The script processes each `seedMemos` entry:

1. Parses `createdAt` and `updatedAt` as Bangkok local time, converts to UTC.
2. Inserts one `memos` row with all fields mapped per §5.
3. Inserts one `workflow_step_actions` row with `action_type = 'submit'`, `acted_at = created_at`.

For DB-1 prototype use, the script clears the four DB-1 tables before inserting the seed rows. Do not use this reset behavior once DB-2 write persistence starts storing user-created data.

Verify:

```sql
SELECT memo_no, status, current_step, created_at FROM memos ORDER BY created_at DESC;
-- Expected: 8 rows, EM-2026-001 through EM-2026-008

SELECT memo_id, action_type, acted_at FROM workflow_step_actions;
-- Expected: 8 rows, all action_type = 'submit'
```

### Step 3 — Read path API

Create a `GET /api/memos` Next.js route handler that:

1. Queries `memos` left-joined with `read_actions` on `memo_id` and `revision_no = memos.revision_no`.
2. Serializes each `memos` row to the `MemoRecord` shape:
   - Maps `memos.memo_no → MemoRecord.id` (non-negotiable)
   - Decodes JSON columns to their array types (`recommended_route_json → recommendedRoute[]`, etc.)
   - Converts UTC datetimes to `"DD Mon YYYY HH:MM"` Bangkok display strings
   - Returns `cycle_hours ?? 0` for frontend KPI compat
   - Reconstructs `readActions[]` from joined `read_actions` rows; leaves it `undefined` when no rows exist
3. Returns a JSON array of `MemoRecord`-shaped objects.

Switch `MemoProvider`'s initial state from `seedMemos` to the result of this API call on first load. Mutations still go to the reducer in-memory during DB-1. A page refresh reloads from DB (seed data only). This is expected behavior for DB-1.

Verify by loading `/queue` and confirming:

- Eight seed memos appear with the correct `memo_no` values as their displayed IDs
- Statuses, departments, amounts, and Bangkok-formatted timestamps are correct
- The drawer opens without errors for each seed memo

---

## 10. Risks and Open Decisions

### High severity

**memo_no → MemoRecord.id serializer correctness.** If the API accidentally returns the BIGINT PK as `id`, every downstream UI reference breaks silently: queue table IDs, drawer headers, URL params, revision history chips, and any code that passes `memo.id` back to an API call. This mapping must be covered by an integration test before DB-1 is declared complete.

**Timestamp conversion error in seed migration.** The seed strings carry no timezone marker. The migration script must explicitly treat them as Bangkok (UTC+7). Validate each converted row individually. An off-by-7-hours error will break history page date grouping without an obvious error message.

### Medium severity

**read_actions revision_no must be inserted with the correct value.** In DB-2, the resubmit transaction must: (1) insert `memo_revisions` with the old `revision_no`, (2) update `memos.revision_no`, (3) insert `read_actions` with the new `revision_no`. Reversing steps 2 and 3 causes the scope query to return stale rows. Document this order explicitly in the DB-2 implementation plan.

**selected_vendor_id is an opaque string.** It references an entry inside `price_comparisons_json` by a `Date.now()` string ID. When `price_comparisons` is normalized in Phase 3, a data migration must re-key every existing `selected_vendor_id` to a proper integer FK. Plan for this migration before Phase 3 begins.

**Seed memos with absent selectedRoute.** Several seeds have no `selectedRoute`. The drawer timeline silently falls back to "all pending" visuals for these. The DB representation (`selected_route_json = NULL`) is correct and matches the prototype's behavior. This is a known prototype gap, not a schema issue.

### Low severity

**cycle_hours will be NULL for all new memos in DB-1.** The Avg. cycle KPI card in `history/page.tsx` reads `m.cycleHours`. The API returns `cycle_hours ?? 0`, so the KPI reads lower than the true average when new memos are included. This is acceptable for DB-1 validation.

**revision_impact is always NULL.** The column exists as a placeholder. No application logic reads it in DB-1 or DB-2. It will not cause errors.

**actor_name is always the mock user "อำภา หิงคำ".** All seed `workflow_step_actions` rows and all DB-2 write rows carry this name until Phase 5 replaces it with `actor_user_id`. Correct for an auditable single-user prototype.

**MySQL vs SQLite.** The SA targets MySQL 8, and the schema above is written for MySQL 8. Docker Compose now includes a MySQL 8 service for DB-1 schema validation. If SQLite is chosen later for faster prototype iteration, treat it as a temporary adapter: SQLite stores JSON as text with JSON functions rather than MySQL's native JSON column behavior, so schema and migration SQL must be adjusted deliberately.

---

*End of DB-1 Schema Plan. Schema and seed migration may begin after explicit approval.*
