# Spec: Harden Workflow Actions for Future Telegram Executive Approval

## Context

Project: `D:\Hrproject\sandbox`

This is the HR&GA E-Memo prototype using Next.js + MySQL. The system already has:
- Real `users` table and JWT auth.
- `memos`, `read_actions`, `workflow_step_actions`.
- Existing workflow write routes:
  - `POST /api/memos/[id]/advance`
  - `POST /api/memos/[id]/return`
  - `POST /api/memos/[id]/reject`
  - `POST /api/memos/[id]/read`
  - `POST /api/memos/[id]/skip-reads`
- Prototype permission helpers in `src/lib/prototype-users.ts`.
- Existing DB write payload helpers in `src/lib/db-memo-write.ts`.

Goal: prepare the workflow layer so future Telegram bot actions can safely approve, return, and reject memos. Telegram implementation itself is not part of this task.

## Problem

Current workflow routes accept important decision fields from the client body, such as:
- `actorName`
- `stepLabel`
- `nextCurrentStep`
- `nextStatus`
- `nextWorkflowState`

This is acceptable for prototype UI simulation, but unsafe for Telegram or production-like workflow actions. Server code must determine actor identity, permission, and next workflow state.

## Objective

Create a server-side workflow action service that becomes the single trusted path for approve, return, and reject actions.

Both web routes and the Telegram webhook should call this service. The client must no longer be trusted to decide actor name, step, next step, status, or permission.

## Scope

Implement server-side hardening for:
- Approve / advance step
- Return memo
- Reject memo

Out of scope:
- Actual Telegram bot webhook
- Telegram account linking
- Notification tables
- UI redesign
- Database auth redesign
- Email, LINE, or other notification integrations

## Required Behavior

### 1. Create Server-Side Workflow Service

Add a new module:

`src/lib/workflow-actions.ts`

Export functions:

```ts
approveMemoAction(input: {
  memoNo: string;
  actorUserId: number;
  source: "web" | "telegram";
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true }>;

returnMemoAction(input: {
  memoNo: string;
  actorUserId: number;
  reason: string;
  source: "web" | "telegram";
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true }>;

rejectMemoAction(input: {
  memoNo: string;
  actorUserId: number;
  disposition: "close" | "revision-allowed";
  reason: string;
  source: "web" | "telegram";
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true }>;
```

Each function must:
- Open a DB transaction.
- Load memo row with `SELECT * FROM memos WHERE memo_no = ? FOR UPDATE`.
- Load active user by `actorUserId`.
- Reject if user is missing or not `active`.
- Convert DB user into a permission shape using existing patterns if possible.
- Check memo is `pending`.
- Check actor can act on the current step.
- Write memo update.
- Insert a `workflow_step_actions` row.
- Commit the transaction.
- Roll back on error.

### 2. Server-Side Permission Rule

For approve, return, and reject:

User can act if:
- user has `admin` role, or
- user `approval_level` equals `memos.current_step`.

Do not grant approval permission from department name alone.

This must preserve the existing rule that HR&GA department alone is not privileged.

### 3. Server-Side Approve Step Calculation

Do not accept `nextCurrentStep`, `nextStatus`, or `nextWorkflowState` from client code.

Calculate from `memos.selected_route_json`.

Example:

```ts
selectedRoute = ["Manager / Top Section", "General Manager", "Managing Director"];
currentStep = "General Manager";
```

If current step is not the final step:
- next step = next item in selected route
- status remains `pending`
- workflow state should continue according to existing app conventions

If current step is final:
- status becomes `approved`
- current step can remain the final approver label
- workflow state should reflect approved/completed state, matching existing app conventions

If `selected_route_json` is missing or current step is not found:
- return a controlled error
- do not update the memo

### 4. Read Action Gate

Approve must be blocked if the current revision has pending read actions:

```sql
SELECT COUNT(*) FROM read_actions
WHERE memo_id = ?
  AND revision_no = ?
  AND status = 'pending'
```

If count is greater than 0:
- return an error like `Pending read acknowledgements remain`
- do not approve

Return and reject do not need to be blocked by pending reads unless existing product behavior requires it.

### 5. Actor Name Must Come From DB User

Do not accept `actorName` from the request body for these actions.

Use:

```ts
`${first_name} ${last_name}`.trim()
```

Store that value in `workflow_step_actions.actor_name`.

### 6. Audit Metadata

When inserting `workflow_step_actions.metadata_json`, include action source:

```json
{
  "source": "web"
}
```

For future Telegram support, allow extra metadata to merge in:

```json
{
  "source": "telegram",
  "telegram_user_id": "...",
  "telegram_message_id": "..."
}
```

### 7. Update Existing API Routes

Update:
- `src/app/api/memos/[id]/advance/route.ts`
- `src/app/api/memos/[id]/return/route.ts`
- `src/app/api/memos/[id]/reject/route.ts`

Each route must:
- Read JWT cookie using existing `getActiveSessionUserFromToken`.
- Return `401` if no active session exists.
- Pass `session.userId` to the workflow service.
- Accept only minimal body fields:
  - approve: no trusted workflow fields needed
  - return: `returnReason`
  - reject: `disposition`, `rejectReason`

Existing client calls may still send old fields temporarily, but routes must ignore trusted workflow fields.

### 8. Preserve Existing Frontend Behavior

Queue page should continue working:
- Approve button still advances memo.
- Return still requires reason.
- Reject still requires disposition and reason.
- Audit log still shows action rows.
- In-memory fallback should not be broken.

If changing `memo-store.tsx` request bodies is required, keep the UI behavior the same.

### 9. Tests

Add or update tests.

Required unit tests:
- Manager can approve memo at Manager step.
- Manager cannot approve memo at GM step.
- GM can approve GM step and advance to MD when route continues.
- MD approving final MD step marks memo approved.
- Approve is blocked when pending read actions exist.
- Return requires active authorized approver.
- Reject requires active authorized approver.
- `actor_name` is derived from DB user, not request body.
- `metadata_json` includes `{ source: "web" }`.

If service tests require DB mocking, create focused pure helpers for:
- permission check
- next-step calculation
- metadata building

Then test those helpers without needing live MySQL.

### 10. Verification

Run from `D:\Hrproject\sandbox`:

```bash
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

All must pass.

## Acceptance Criteria

- Workflow approve, return, and reject no longer trust client-provided actor or next-step fields.
- Server checks active user and approval permission.
- Approve cannot bypass pending read acknowledgements.
- Existing queue workflow still works from the browser.
- Audit rows still write to `workflow_step_actions`.
- Code is ready for a future `/api/telegram/webhook` to call the same workflow service safely.
