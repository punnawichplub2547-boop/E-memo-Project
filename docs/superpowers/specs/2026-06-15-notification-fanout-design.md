# Notification Fan-out: notify requester + CC on submit and every status change

**Date:** 2026-06-15
**Status:** Design approved, pending spec review

## Problem

Today notifications fire only from `advance`/`return`/`reject` and reach a narrow audience:

| Current event | Who is notified |
|---|---|
| advance (intermediate) | next approver only ("รออนุมัติ" + Telegram approve button) |
| advance (final) | requester ("อนุมัติแล้ว") |
| returned / rejected | requester |

Gaps:
- Memo creation/submission notifies **no one**.
- **CC / read recipients are never notified** at any point.
- The requester is **not notified on intermediate steps** — only at final/return/reject.

## Goal

Notify **requester + CC (individuals)** when a memo is **submitted** and on **every status change** (approve at any step, return, reject, resubmit/revision) — via **in-app** (always) and **Telegram** (only for recipients with a linked account). Keep the existing actionable "next approver" notification (with the approve button) unchanged.

## Decisions (locked)

- **D1 — POST /api/memos gains session auth.** Verify session via `getActiveSessionUserFromToken`; the server overwrites `requester_name` from `session.firstName + " " + session.lastName` (never trust the client body). The submitted event's actor is `session.userId`.
- **D2 — Keep name-based identity matching (no schema change).** Requester resolved by `CONCAT(first_name,' ',last_name)`. Accepted risk: duplicate display names can resolve to the wrong user / mis-skip the actor. Documented; deferred to a future `requester_user_id` FK.
- **D3 — CC notifies individuals only; department labels are skipped entirely.** A read-recipient label resolves by **email**, then by **exact name**. If it matches only a department (or nothing), it is **skipped with a debug warn** — no department fan-out, in-app or Telegram. This removes the mass-spam risk.
- **D4 — resubmit and submit-revision are status-change events** that also fan out. `submit-revision` gains session auth (currently has none).

## Architecture (Approach B — separate watcher fan-out)

Keep the existing actionable approver notification in place. Add a self-contained **watcher fan-out** reused by every event.

### New pure unit — `computeWatcherRecipients`

```ts
computeWatcherRecipients(input: {
  requesterId: number | null;
  ccIds: number[];
  actorId: number | null;
  excludeActor: boolean;
}): number[]
```

- Union of `requesterId` (if non-null) + `ccIds`, de-duplicated via `Set`.
- Drop `null`/`undefined`.
- If `excludeActor && actorId != null`, remove `actorId`.
- Pure, node-testable (no DB).

### New resolver — `resolveMemoCcRecipients(memoId, revisionNo, pool): Promise<number[]>`

- `SELECT DISTINCT recipient_name FROM read_actions WHERE memo_id = ? AND revision_no = ?` (filter by the memo's **current** revision so CC removed in a later revision is not notified — fixes stale-CC).
- For each label: match `users.email`, else `CONCAT(first_name,' ',last_name)` (each `LIMIT 1`, `status='active'`). **No department branch.**
- Batch where practical: resolve labels with a single `WHERE email IN (...) OR CONCAT(...) IN (...)` query rather than per-label round-trips.
- `console.warn` (debug-level) for any label that resolves to no individual user (avoids silent misses).

### New dispatcher unit — `notifyWatchers(memo, event, actorUserId)`

1. `requesterId = resolveRequesterRecipient(memo.requester_name)`.
2. `ccIds = resolveMemoCcRecipients(memo.id, memo.revision_no)`.
3. `recipients = computeWatcherRecipients({ requesterId, ccIds, actorId: actorUserId, excludeActor: event !== "submitted" })`.
4. Batch-load Telegram chat ids: `SELECT user_id, telegram_chat_id FROM user_telegram_accounts WHERE user_id IN (...) AND is_active = TRUE` (one query, not per-user).
5. For each recipient: `createNotification` (in-app, `action_url` = relative `/queue?memo=<memo_no>`) + if a chat id exists, send a Telegram **FYI** message with an **"เปิดใน E-Memo"** link button only (no approve button; absolute URL for Telegram). The notification `type`/title is derived per the event matrix below — for `submitted` the requester gets `memo_submitted` and CC get `memo_cc`; for every other event all watchers share the event's single type.
6. Fire-and-forget; wrapped in try/catch; never throws (matches existing dispatcher). Reads via `getDbPool()` and must run **after** the route's `commit`.

The existing "next approver" actionable notification (`resolveApprovalStepRecipients` + approve button) stays as-is.

## Event matrix

Watchers = requester + CC (individuals), in-app always + Telegram if linked.

| Event | Trigger point | Actor | Actionable (existing) | Watcher fan-out (new) | excludeActor |
|---|---|---|---|---|---|
| **submitted** | `POST /api/memos` after commit | `session.userId` | — | requester → `memo_submitted`, CC → `memo_cc` | **false** (requester gets a confirmation) |
| **advance — intermediate** | advance route | `session.userId` | next approver "รออนุมัติ" + approve button | `memo_status_update` | true |
| **advance — final** | advance route | `session.userId` | — | `memo_approved` (replaces old standalone requester notif) | true |
| **returned** | return route | `session.userId` | — | `memo_returned` | true |
| **rejected** | reject route | `session.userId` | — | `memo_rejected` | true |
| **resubmitted** | resubmit + submit-revision routes | `session.userId` | first/current-step approver "รออนุมัติ" + approve button | `memo_status_update` | true |

> The standalone requester notification currently in the advance-final / returned / rejected branches is **replaced** by the watcher fan-out (which already includes the requester) to avoid double-notifying.

## Files changed

- `src/lib/notify-memo-event.ts` — add `computeWatcherRecipients`, `notifyWatchers`; add `actorUserId: number | null` param to `notifyMemoEvent`; add `"submitted"` and `"resubmitted"` event types; refactor existing branches to use the fan-out.
- `src/lib/notification-recipients.ts` — add `resolveMemoCcRecipients(memoId, revisionNo, pool)` (email/name only, batched, warn on miss).
- `src/lib/notifications.ts` — add `TYPE_LABELS`: `memo_submitted` = "ส่งเข้าระบบแล้ว", `memo_status_update` = "อัปเดตสถานะ".
- `src/app/api/memos/route.ts` — add session verification; overwrite `requester_name` from session; after commit, `void notifyMemoEvent(memo.memo_no, "submitted", session.userId)`.
- `src/app/api/memos/[id]/advance|return|reject/route.ts` — pass `session.userId` into `notifyMemoEvent`.
- `src/app/api/memos/[id]/resubmit/route.ts` — call `notifyMemoEvent(memoNo, "resubmitted", session.userId)` after success.
- `src/app/api/memos/[id]/submit-revision/route.ts` — add session verification (currently none) + fire `"resubmitted"` event.

## Testing

- `compute-watcher-recipients.test.ts` (pure): actor == requester; actor ∈ CC; `requesterId = null`; empty CC; `actorId = null` (submitted keeps requester); duplicate ids deduped.
- `notification-recipients.test.ts` (fake pool): `resolveMemoCcRecipients` resolves email and name, **skips** department-only / unmatched labels, filters by `revision_no`.
- Update/spot-check route wiring where feasible.
- `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` from `sandbox/`.
- Manual Playwright smoke (in-app only; Telegram env not live): create a memo with a CC'd individual → both requester and CC see a bell notification; approve a step → both get an "อัปเดตสถานะ" notification; the acting approver does **not** get one for their own action.

## Out of scope (YAGNI)

- Per-user notification preferences / channel toggles.
- Digest / batching of notifications.
- Department fan-out (explicitly excluded — D3).
- `requester_user_id` FK migration (D2 — deferred).
- Telegram go-live (env config + webhook) — separate task; code attempts delivery only when an account is linked.

## Accepted risks

- **Duplicate notifications on route retry** — fan-out runs outside the workflow transaction; a client retry after a successful action may re-emit. Acceptable for the prototype.
- **Duplicate display names** (D2) — may mis-target or mis-skip the actor until a `requester_user_id` FK exists.
