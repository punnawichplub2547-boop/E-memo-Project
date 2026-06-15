# Notification Fan-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify the requester + individual CC recipients (in-app always, Telegram if linked) when a memo is submitted and on every status change (advance/return/reject/resubmit), not just at completion.

**Architecture:** Approach B — a self-contained "watcher fan-out" (`notifyWatchers`) reused by every event, layered on top of the existing actionable approver notification (unchanged). A pure `computeWatcherRecipients` does dedup + actor exclusion; `resolveMemoCcRecipients` resolves CC individuals only (no department fan-out).

**Tech Stack:** Next.js route handlers, mysql2, vitest. Spec: `docs/superpowers/specs/2026-06-15-notification-fanout-design.md`.

---

## File Structure

- `src/lib/notifications.ts` — add two `TYPE_LABELS` + export `buildMemoNotificationTitle`.
- `src/lib/notify-memo-event.ts` — add `computeWatcherRecipients` (pure), `notifyWatchers`, `notifyApprovers`, batched `getChatIds`; extend `notifyMemoEvent` with `actorUserId` + `submitted`/`resubmitted`; add `revision_no` to the memo query.
- `src/lib/notification-recipients.ts` — add `resolveMemoCcRecipients` (email/name only, revision-filtered, batched, warn on miss).
- `src/app/api/memos/route.ts` — POST session auth + server-set `requester_name` + fire `submitted`.
- `src/app/api/memos/[id]/advance|return|reject/route.ts` — pass `session.userId` to `notifyMemoEvent`.
- `src/app/api/memos/[id]/resubmit/route.ts` — fire `resubmitted` after commit.
- `src/app/api/memos/[id]/submit-revision/route.ts` — add session auth + ownership + fire `resubmitted`.
- Tests: `src/lib/notifications.test.ts`, `src/lib/notify-memo-event.test.ts` (new), `src/lib/notification-recipients.test.ts`.

---

## Task 1: Notification labels + title helper

**Files:**
- Modify: `src/lib/notifications.ts`
- Test: `src/lib/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/notifications.test.ts` (import `buildMemoNotificationTitle` alongside the existing imports from `./notifications`):

```ts
describe("buildMemoNotificationTitle", () => {
  it("uses the Thai label for known types", () => {
    expect(buildMemoNotificationTitle("memo_submitted", "EM-1")).toBe("ส่งเข้าระบบแล้ว: EM-1");
    expect(buildMemoNotificationTitle("memo_status_update", "EM-2")).toBe("อัปเดตสถานะ: EM-2");
    expect(buildMemoNotificationTitle("memo_approved", "EM-3")).toBe("อนุมัติแล้ว: EM-3");
  });
  it("falls back to the raw type for unknown types", () => {
    expect(buildMemoNotificationTitle("something_else", "EM-4")).toBe("something_else: EM-4");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run src/lib/notifications.test.ts`
Expected: FAIL — `buildMemoNotificationTitle` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/notifications.ts`, add the two labels to the existing `TYPE_LABELS` map and export the helper. Place the helper directly below `TYPE_LABELS`:

```ts
const TYPE_LABELS: Record<string, string> = {
  memo_pending_approval: "รออนุมัติ",
  memo_pending_read:     "รอรับทราบ",
  memo_cc:               "แจ้งเพื่อทราบ",
  memo_returned:         "ส่งคืนแก้ไข",
  memo_rejected:         "ปฏิเสธ",
  memo_approved:         "อนุมัติแล้ว",
  memo_submitted:        "ส่งเข้าระบบแล้ว",
  memo_status_update:    "อัปเดตสถานะ",
};

export function buildMemoNotificationTitle(type: string, memoNo: string): string {
  return `${TYPE_LABELS[type] ?? type}: ${memoNo}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run src/lib/notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/lib/notifications.ts sandbox/src/lib/notifications.test.ts
git commit -m "feat: notification labels for submitted/status-update + title helper"
```

---

## Task 2: `computeWatcherRecipients` pure function

**Files:**
- Modify: `src/lib/notify-memo-event.ts`
- Test: `src/lib/notify-memo-event.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/notify-memo-event.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeWatcherRecipients } from "./notify-memo-event";

describe("computeWatcherRecipients", () => {
  it("unions requester + cc and dedups", () => {
    const r = computeWatcherRecipients({ requesterId: 1, ccIds: [2, 3, 2], actorId: null, excludeActor: false });
    expect(r.sort()).toEqual([1, 2, 3]);
  });
  it("drops a null requester", () => {
    expect(computeWatcherRecipients({ requesterId: null, ccIds: [5], actorId: null, excludeActor: true })).toEqual([5]);
  });
  it("excludes the actor when excludeActor is true", () => {
    const r = computeWatcherRecipients({ requesterId: 1, ccIds: [2, 3], actorId: 2, excludeActor: true });
    expect(r.sort()).toEqual([1, 3]);
  });
  it("keeps the actor when excludeActor is false (submitted confirmation)", () => {
    const r = computeWatcherRecipients({ requesterId: 7, ccIds: [], actorId: 7, excludeActor: false });
    expect(r).toEqual([7]);
  });
  it("returns empty when nobody resolves", () => {
    expect(computeWatcherRecipients({ requesterId: null, ccIds: [], actorId: 9, excludeActor: true })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run src/lib/notify-memo-event.test.ts`
Expected: FAIL — `computeWatcherRecipients` not exported.

- [ ] **Step 3: Implement**

In `src/lib/notify-memo-event.ts`, add near the top (after imports, before `getMemo`):

```ts
// Pure: who should receive a watcher (FYI) notification for an event.
export function computeWatcherRecipients(input: {
  requesterId: number | null;
  ccIds: number[];
  actorId: number | null;
  excludeActor: boolean;
}): number[] {
  const set = new Set<number>();
  if (input.requesterId != null) set.add(input.requesterId);
  for (const id of input.ccIds) if (id != null) set.add(id);
  if (input.excludeActor && input.actorId != null) set.delete(input.actorId);
  return [...set];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run src/lib/notify-memo-event.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/lib/notify-memo-event.ts sandbox/src/lib/notify-memo-event.test.ts
git commit -m "feat: computeWatcherRecipients pure helper (dedup + actor exclusion)"
```

---

## Task 3: `resolveMemoCcRecipients` (individuals only)

**Files:**
- Modify: `src/lib/notification-recipients.ts`
- Test: `src/lib/notification-recipients.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/notification-recipients.test.ts`. Use a fake pool whose `query` returns canned results in call order (first the label rows, then the user rows):

```ts
import { resolveMemoCcRecipients } from "./notification-recipients";

function ccPool(labelRows: unknown, userRows: unknown) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let i = 0;
  const results = [labelRows, userRows];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return [results[i++], undefined];
    },
  } as unknown as import("mysql2/promise").Pool;
  return { pool, calls };
}

describe("resolveMemoCcRecipients", () => {
  it("resolves email and exact-name labels to user ids, filtered by revision", async () => {
    const { pool, calls } = ccPool(
      [{ recipient_name: "a@car-1996.com" }, { recipient_name: "สมชาย ขายจริง" }],
      [
        { id: 10, email: "a@car-1996.com", full_name: "Aaa Bbb" },
        { id: 11, email: "x@car-1996.com", full_name: "สมชาย ขายจริง" },
      ],
    );
    const ids = await resolveMemoCcRecipients(7, 2, pool);
    expect(ids.sort()).toEqual([10, 11]);
    expect(calls[0].sql).toContain("revision_no = ?");
    expect(calls[0].params).toEqual([7, 2]);
  });

  it("returns empty when the memo has no read recipients", async () => {
    const { pool } = ccPool([], []);
    expect(await resolveMemoCcRecipients(7, 1, pool)).toEqual([]);
  });

  it("skips department-only / unmatched labels (no fan-out)", async () => {
    const { pool } = ccPool([{ recipient_name: "PD" }], []); // 'PD' matches no email/name
    expect(await resolveMemoCcRecipients(7, 1, pool)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run src/lib/notification-recipients.test.ts`
Expected: FAIL — `resolveMemoCcRecipients` not exported.

- [ ] **Step 3: Implement**

In `src/lib/notification-recipients.ts` add (the file already imports `Pool`, `RowDataPacket`, and defines `IdRow`):

```ts
type CcUserRow = RowDataPacket & { id: number; email: string; full_name: string };

// CC notifications target INDIVIDUALS only. Labels are matched by email or exact
// full name; department labels (or anything unmatched) are skipped — never fanned
// out to a whole department. Filtered by the memo's current revision so CC removed
// in a later revision is not notified.
export async function resolveMemoCcRecipients(
  memoId: number,
  revisionNo: number,
  pool: Pool,
): Promise<number[]> {
  const [labelRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT recipient_name FROM read_actions WHERE memo_id = ? AND revision_no = ?",
    [memoId, revisionNo],
  );
  const labels = labelRows
    .map((r) => String((r as { recipient_name: string }).recipient_name))
    .filter((s) => s.length > 0);
  if (labels.length === 0) return [];

  const [userRows] = await pool.query<CcUserRow[]>(
    `SELECT id, email, CONCAT(first_name, ' ', last_name) AS full_name
       FROM users
      WHERE status = 'active'
        AND (email IN (?) OR CONCAT(first_name, ' ', last_name) IN (?))`,
    [labels, labels],
  );

  const matched = new Set<string>();
  const ids = new Set<number>();
  for (const row of userRows) {
    ids.add(row.id);
    matched.add(row.email);
    matched.add(row.full_name);
  }
  for (const label of labels) {
    if (!matched.has(label)) {
      console.warn(`[resolveMemoCcRecipients] CC label not matched to an individual user (skipped): ${label}`);
    }
  }
  return [...ids];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run src/lib/notification-recipients.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/lib/notification-recipients.ts sandbox/src/lib/notification-recipients.test.ts
git commit -m "feat: resolveMemoCcRecipients — individual CC only, revision-filtered"
```

---

## Task 4: Watcher fan-out in `notify-memo-event.ts`

**Files:**
- Modify: `src/lib/notify-memo-event.ts`

This task rewrites the dispatcher body. Replace the whole file with the content below (it already contains `computeWatcherRecipients` from Task 2 — keep it).

- [ ] **Step 1: Replace the file contents**

```ts
// Fire-and-forget dispatcher. Never throws. Workflow must not be blocked by notification failures.
import { getDbPool } from "./db";
import {
  buildMemoNotificationText,
  buildMemoNotificationTitle,
  createNotification,
  createTelegramDelivery,
  markDeliveryStatus,
} from "./notifications";
import {
  resolveApprovalStepRecipients,
  resolveRequesterRecipient,
  resolveMemoCcRecipients,
} from "./notification-recipients";
import { sendTelegramMessage, buildInlineKeyboard } from "./telegram/client";
import { createApproveActionToken } from "./telegram/actions";
import type { RowDataPacket } from "mysql2";

type MemoRow = RowDataPacket & {
  id: number; memo_no: string; title: string; requester_name: string;
  current_step: string; status: string; revision_no: number;
};
type ChatRow = RowDataPacket & { user_id: number; telegram_chat_id: string };

export type MemoEventType = "submitted" | "resubmitted" | "advanced" | "returned" | "rejected";

// Pure: who should receive a watcher (FYI) notification for an event.
export function computeWatcherRecipients(input: {
  requesterId: number | null;
  ccIds: number[];
  actorId: number | null;
  excludeActor: boolean;
}): number[] {
  const set = new Set<number>();
  if (input.requesterId != null) set.add(input.requesterId);
  for (const id of input.ccIds) if (id != null) set.add(id);
  if (input.excludeActor && input.actorId != null) set.delete(input.actorId);
  return [...set];
}

async function getMemo(memoNo: string): Promise<MemoRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<MemoRow[]>(
    "SELECT id, memo_no, title, requester_name, current_step, status, revision_no FROM memos WHERE memo_no = ? LIMIT 1",
    [memoNo],
  );
  return rows[0] ?? null;
}

async function getChatIds(userIds: number[]): Promise<Map<number, bigint>> {
  const map = new Map<number, bigint>();
  if (userIds.length === 0) return map;
  const pool = getDbPool();
  const [rows] = await pool.query<ChatRow[]>(
    "SELECT user_id, telegram_chat_id FROM user_telegram_accounts WHERE user_id IN (?) AND is_active = TRUE",
    [userIds],
  );
  for (const r of rows) map.set(r.user_id, BigInt(r.telegram_chat_id));
  return map;
}

async function sendAndTrack(
  pool: ReturnType<typeof getDbPool>,
  notifId: number,
  chatId: bigint,
  text: string,
  replyMarkup?: ReturnType<typeof buildInlineKeyboard>,
) {
  await createTelegramDelivery(pool, notifId);
  const sent = await sendTelegramMessage(chatId, text, replyMarkup ? { replyMarkup } : undefined);
  await markDeliveryStatus(pool, notifId, "telegram", sent ? "sent" : "failed", {
    providerId: sent ? String(sent.message_id) : undefined,
  });
}

// Actionable: notify the approvers at the memo's current step, with an approve button.
async function notifyApprovers(memo: MemoRow, queuePath: string, queueUrl: string): Promise<void> {
  const pool = getDbPool();
  const recipientIds = await resolveApprovalStepRecipients(memo.current_step, pool);
  if (recipientIds.length === 0) return;
  const chatIds = await getChatIds(recipientIds);
  const ctx = { memoNo: memo.memo_no, title: memo.title, requesterName: memo.requester_name, currentStep: memo.current_step };
  const text = buildMemoNotificationText("memo_pending_approval", ctx);
  for (const recipientUserId of recipientIds) {
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId, type: "memo_pending_approval",
      title: buildMemoNotificationTitle("memo_pending_approval", memo.memo_no), body: text, actionUrl: queuePath,
    });
    const chatId = chatIds.get(recipientUserId);
    if (chatId) {
      const { tokenDbId } = await createApproveActionToken(memo.id, recipientUserId, chatId, pool);
      await sendAndTrack(pool, notifId, chatId, text, buildInlineKeyboard([[
        { text: "✅ อนุมัติ", callback_data: `approve:${tokenDbId}` },
        { text: "เปิดใน E-Memo", url: queueUrl },
      ]]));
    }
  }
}

// Watcher (FYI): notify requester + individual CC. `submitted` keeps the actor
// (requester confirmation) and uses memo_submitted/memo_cc; other events exclude
// the actor and use a single shared type.
async function notifyWatchers(
  memo: MemoRow,
  types: { requesterType: string; ccType: string },
  actorUserId: number | null,
  excludeActor: boolean,
  queuePath: string,
  queueUrl: string,
): Promise<void> {
  const pool = getDbPool();
  const requesterId = await resolveRequesterRecipient(memo.requester_name, pool);
  const ccIds = await resolveMemoCcRecipients(memo.id, memo.revision_no, pool);
  const recipients = computeWatcherRecipients({ requesterId, ccIds, actorId: actorUserId, excludeActor });
  if (recipients.length === 0) return;
  const chatIds = await getChatIds(recipients);
  const ctx = { memoNo: memo.memo_no, title: memo.title, requesterName: memo.requester_name, currentStep: memo.current_step };
  for (const userId of recipients) {
    const type = userId === requesterId ? types.requesterType : types.ccType;
    const text = buildMemoNotificationText(type, ctx);
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId: userId, type,
      title: buildMemoNotificationTitle(type, memo.memo_no), body: text, actionUrl: queuePath,
    });
    const chatId = chatIds.get(userId);
    if (chatId) await sendAndTrack(pool, notifId, chatId, text, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
  }
}

export async function notifyMemoEvent(
  memoNo: string,
  eventType: MemoEventType,
  actorUserId: number | null,
): Promise<void> {
  try {
    const memo = await getMemo(memoNo);
    if (!memo) return;

    const appUrl = process.env.APP_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const queuePath = `/queue?memo=${encodeURIComponent(memo.memo_no)}`;
    const queueUrl = `${appUrl}${queuePath}`;

    if (eventType === "submitted") {
      await notifyWatchers(memo, { requesterType: "memo_submitted", ccType: "memo_cc" }, actorUserId, false, queuePath, queueUrl);
      return;
    }
    if (eventType === "resubmitted") {
      await notifyApprovers(memo, queuePath, queueUrl);
      await notifyWatchers(memo, { requesterType: "memo_status_update", ccType: "memo_status_update" }, actorUserId, true, queuePath, queueUrl);
      return;
    }
    if (eventType === "advanced" && memo.status === "approved") {
      await notifyWatchers(memo, { requesterType: "memo_approved", ccType: "memo_approved" }, actorUserId, true, queuePath, queueUrl);
      return;
    }
    if (eventType === "advanced") {
      await notifyApprovers(memo, queuePath, queueUrl);
      await notifyWatchers(memo, { requesterType: "memo_status_update", ccType: "memo_status_update" }, actorUserId, true, queuePath, queueUrl);
      return;
    }
    // returned | rejected
    const type = eventType === "returned" ? "memo_returned" : "memo_rejected";
    await notifyWatchers(memo, { requesterType: type, ccType: type }, actorUserId, true, queuePath, queueUrl);
  } catch (err) {
    console.error("[notifyMemoEvent] non-fatal error:", err);
  }
}
```

- [ ] **Step 2: Verify the existing event tests still pass**

Run: `npm.cmd test -- --run src/lib/notify-memo-event.test.ts`
Expected: PASS (the `computeWatcherRecipients` suite still passes against the kept function).

- [ ] **Step 3: Typecheck via build of the lib**

Run: `npm.cmd run lint`
Expected: no errors in `notify-memo-event.ts`.

- [ ] **Step 4: Commit**

```bash
git add sandbox/src/lib/notify-memo-event.ts
git commit -m "feat: watcher fan-out (requester + CC) on every memo event"
```

---

## Task 5: Pass actor into advance/return/reject

**Files:**
- Modify: `src/app/api/memos/[id]/advance/route.ts:20`
- Modify: `src/app/api/memos/[id]/return/route.ts:23`
- Modify: `src/app/api/memos/[id]/reject/route.ts:26`

- [ ] **Step 1: Edit advance route**

Change line 20 from:
```ts
    void notifyMemoEvent(memoNo, "advanced").catch(() => {});
```
to:
```ts
    void notifyMemoEvent(memoNo, "advanced", session.userId).catch(() => {});
```

- [ ] **Step 2: Edit return route**

Change line 23 from:
```ts
    void notifyMemoEvent(memoNo, "returned").catch(() => {});
```
to:
```ts
    void notifyMemoEvent(memoNo, "returned", session.userId).catch(() => {});
```

- [ ] **Step 3: Edit reject route**

Change line 26 from:
```ts
    void notifyMemoEvent(memoNo, "rejected").catch(() => {});
```
to:
```ts
    void notifyMemoEvent(memoNo, "rejected", session.userId).catch(() => {});
```

- [ ] **Step 4: Lint**

Run: `npm.cmd run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/app/api/memos/[id]/advance/route.ts sandbox/src/app/api/memos/[id]/return/route.ts sandbox/src/app/api/memos/[id]/reject/route.ts
git commit -m "feat: pass actor userId into approve/return/reject notifications"
```

---

## Task 6: POST /api/memos — session auth + submitted event

**Files:**
- Modify: `src/app/api/memos/route.ts` (POST handler, ~lines 86-108)

- [ ] **Step 1: Add imports**

At the top of `src/app/api/memos/route.ts`, add (the file already imports `getActiveSessionUserFromToken, COOKIE_NAME` from `@/lib/auth`):
```ts
import { notifyMemoEvent } from "@/lib/notify-memo-event";
```

- [ ] **Step 2: Rewrite the POST handler**

Replace the entire `export async function POST(...) { ... }` block (lines 86-108) with:

```ts
export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connection: PoolConnection | null = null;
  try {
    const memo = await request.json() as MemoRecord;
    // Never trust the client for identity — the creator is the session user.
    memo.requester = `${session.firstName} ${session.lastName}`;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const memoId = await insertMemo(connection, memo);
    await connection.commit();

    // Fire-and-forget AFTER commit so the read_actions rows are visible to the dispatcher pool.
    void notifyMemoEvent(memo.id, "submitted", session.userId).catch(() => {});

    return NextResponse.json({ id: memo.id, memoDbId: memoId }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    if (isDuplicateMemoNoError(error)) {
      return NextResponse.json({ error: "Memo already exists" }, { status: 409 });
    }
    console.error("[POST /api/memos]", error);
    return NextResponse.json({ error: "Unable to create memo" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
```

> Note (verified): `MemoRecord.requester` (`approval.ts:146`) flows into `requester_name` via `memoToDbSeedRow` (`db-seed.ts:119` → `requester_name: memo.requester`). `memo.id` is the business memo number (`EM-...`) used as `memo_no`.

- [ ] **Step 3: Lint + build**

Run: `npm.cmd run lint`
Expected: clean (POST now uses `NextRequest`, already imported on line 1).

- [ ] **Step 4: Commit**

```bash
git add sandbox/src/app/api/memos/route.ts
git commit -m "feat: POST /api/memos requires session; fire submitted notification"
```

---

## Task 7: resubmit fires the resubmitted event

**Files:**
- Modify: `src/app/api/memos/[id]/resubmit/route.ts`

- [ ] **Step 1: Add import**

At the top of `src/app/api/memos/[id]/resubmit/route.ts` add:
```ts
import { notifyMemoEvent } from "@/lib/notify-memo-event";
```

- [ ] **Step 2: Fire after commit**

Find `await connection.commit();` (line 157) followed by `return NextResponse.json({ ok: true });`. Insert between them:
```ts
    await connection.commit();
    void notifyMemoEvent(memoNo, "resubmitted", session.userId).catch(() => {});
    return NextResponse.json({ ok: true });
```

- [ ] **Step 3: Lint**

Run: `npm.cmd run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add sandbox/src/app/api/memos/[id]/resubmit/route.ts
git commit -m "feat: resubmit fires resubmitted notification (approvers + watchers)"
```

---

## Task 8: submit-revision — session auth + resubmitted event

**Files:**
- Modify: `src/app/api/memos/[id]/submit-revision/route.ts`

- [ ] **Step 1: Update imports and signature**

Replace the import block (lines 1-6) with:
```ts
import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { buildSubmitRevisionPayload, type SubmitRevisionBody } from "@/lib/db-memo-write";
import type { MemoSeedRow } from "@/lib/db-seed";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { notifyMemoEvent } from "@/lib/notify-memo-event";
```

Change the row type to include `requester_name`:
```ts
type MemoIdRow = RowDataPacket & { id: number; requester_name: string };
```

Change the handler signature from `(request: Request, ...)` to `(request: NextRequest, ...)`.

- [ ] **Step 2: Add the auth gate + ownership check**

Right after `const { id: memoNo } = await params;` and before `let connection`, add:
```ts
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Change the memo lookup query to also select `requester_name`:
```ts
    const [rows] = await connection.execute<MemoIdRow[]>(
      "SELECT id, requester_name FROM memos WHERE memo_no = ? FOR UPDATE",
      [memoNo]
    );
```

After the `if (rows.length === 0) { ... }` block, add the ownership guard and server-set actor name:
```ts
    const isAdmin = session.roles.includes("admin");
    if (!isAdmin && rows[0].requester_name !== `${session.firstName} ${session.lastName}`) {
      await connection.rollback();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    body.actorName = `${session.firstName} ${session.lastName}`;
```

- [ ] **Step 3: Fire after commit**

Replace `await connection.commit();` + `return NextResponse.json({ ok: true });` with:
```ts
    await connection.commit();
    void notifyMemoEvent(memoNo, "resubmitted", session.userId).catch(() => {});
    return NextResponse.json({ ok: true });
```

- [ ] **Step 4: Lint**

Run: `npm.cmd run lint`
Expected: clean. (`SubmitRevisionBody.actorName: string | null` exists in `db-memo-write.ts` — verified.)

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/app/api/memos/[id]/submit-revision/route.ts
git commit -m "feat: submit-revision requires session + ownership; fires resubmitted notification"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test -- --run`
Expected: all suites PASS (existing 346 + new: computeWatcherRecipients 5, resolveMemoCcRecipients 3, buildMemoNotificationTitle 2).

- [ ] **Step 2: Lint**

Run: `npm.cmd run lint`
Expected: clean.

- [ ] **Step 3: Build**

Run: `npm.cmd run build`
Expected: success; route tree unchanged (no new routes).

- [ ] **Step 4: Manual smoke (in-app; Telegram env not required)**

With the dev server (`PORT=3005 npm.cmd run dev`) against the local DB (port 3307):
1. Log in, create a memo with one **individual** CC (by email) → log in as that CC user (or query DB) and confirm both requester and CC have a new bell notification ("ส่งเข้าระบบแล้ว" / "แจ้งเพื่อทราบ").
2. Approve an intermediate step as an approver → confirm requester + CC get "อัปเดตสถานะ", the acting approver does **not** get a watcher notification for their own action, and the next approver still gets "รออนุมัติ".
3. Return the memo → requester + CC get "ส่งคืนแก้ไข".
4. Resubmit → requester + CC + the first-step approver are notified.

- [ ] **Step 5: Commit (if any verification fixups were needed)**

```bash
git add -A sandbox/
git commit -m "test: verify notification fan-out end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** submitted (Task 6), every status change incl. resubmit (Tasks 4,5,7,8), requester+CC watcher (Task 4), individual-only CC / no dept fan-out (Task 3), revision filter (Task 3), session auth on POST + submit-revision (Tasks 6,8), actor exclusion except submitted (Tasks 2,4), in-app + Telegram-if-linked (Task 4), batched chat-id query (Task 4). All covered.
- **No migration:** uses the existing `notifications` table; new labels are code-only.
- **Field names verified:** `MemoRecord.requester` → `requester_name` (`db-seed.ts:119`) and `SubmitRevisionBody.actorName` both confirmed against source; no fallbacks needed.
