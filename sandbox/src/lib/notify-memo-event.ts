// Fire-and-forget dispatcher. Never throws. Workflow must not be blocked by notification failures.
import type { Pool } from "mysql2/promise";
import { getDbPool } from "./db";
import {
  buildMemoNotificationText,
  buildMemoNotificationHtml,
  buildMemoNotificationTitle,
  createEmailDelivery,
  createNotification,
  createTelegramDelivery,
  markDeliveryStatus,
} from "./notifications";
import {
  resolveApprovalStepRecipients,
  resolveRequesterRecipient,
  resolveMemoCcRecipients,
  resolveReadRecipientLabels,
} from "./notification-recipients";
import { sendTelegramMessage, buildInlineKeyboard } from "./telegram/client";
import { createApproveActionToken } from "./telegram/actions";
import { getEmailConfig, sendEmailMessage } from "./email/client";
import { wrapEmailHtml, wrapEmailText } from "./email/template";
import type { RowDataPacket } from "mysql2";

type MemoRow = RowDataPacket & {
  id: number; memo_no: string; title: string; requester_name: string;
  requester_user_id: number | null;
  current_step: string; status: string; revision_no: number;
};
type ChatRow = RowDataPacket & { user_id: number; telegram_chat_id: string };
type EmailRow = RowDataPacket & { id: number; email: string };
type SendEmailFn = typeof sendEmailMessage;

export type MemoEventType = "submitted" | "resubmitted" | "advanced" | "returned" | "rejected";

// Pure: who should receive a watcher (FYI) notification for an event.
// excludeIds removes recipients already handled by a different channel (e.g. the
// actionable approver notification) so an approver who is also a CC isn't doubled up.
export function computeWatcherRecipients(input: {
  requesterId: number | null;
  ccIds: number[];
  actorId: number | null;
  excludeActor: boolean;
  excludeIds?: number[];
}): number[] {
  const set = new Set<number>();
  if (input.requesterId != null) set.add(input.requesterId);
  for (const id of input.ccIds) if (id != null) set.add(id);
  if (input.excludeActor && input.actorId != null) set.delete(input.actorId);
  for (const id of input.excludeIds ?? []) set.delete(id);
  return [...set];
}

// Pure: who to notify that they must acknowledge (Read) a memo. Dedups and drops
// the submitting actor (no "please read" for your own memo).
export function computeReadNotifyRecipients(input: {
  readRecipientIds: number[];
  actorId: number | null;
}): number[] {
  const set = new Set<number>();
  for (const id of input.readRecipientIds) if (id != null) set.add(id);
  if (input.actorId != null) set.delete(input.actorId);
  return [...set];
}

// The still-pending Read labels for the memo's current revision (a label is an
// email / exact name / department, resolved to users by resolveReadRecipientLabels).
export async function getPendingReadLabels(
  pool: Pool,
  memoId: number,
  revisionNo: number,
): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT recipient_name FROM read_actions WHERE memo_id = ? AND revision_no = ? AND status = 'pending'",
    [memoId, revisionNo],
  );
  return rows
    .map((r) => String((r as { recipient_name: string }).recipient_name))
    .filter((s) => s.length > 0);
}

async function getMemo(memoNo: string): Promise<MemoRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<MemoRow[]>(
    "SELECT id, memo_no, title, requester_name, requester_user_id, current_step, status, revision_no FROM memos WHERE memo_no = ? AND deleted_at IS NULL LIMIT 1",
    [memoNo],
  );
  return rows[0] ?? null;
}

// Batch-load active Telegram chat ids. Bad/missing chat ids are skipped (not fatal)
// so one malformed row can't sink the whole event.
export async function getChatIds(pool: Pool, userIds: number[]): Promise<Map<number, bigint>> {
  const map = new Map<number, bigint>();
  if (userIds.length === 0) return map;
  const [rows] = await pool.query<ChatRow[]>(
    "SELECT user_id, telegram_chat_id FROM user_telegram_accounts WHERE user_id IN (?) AND is_active = TRUE",
    [userIds],
  );
  for (const r of rows) {
    if (r.telegram_chat_id == null || r.telegram_chat_id === "") continue;
    try {
      map.set(r.user_id, BigInt(r.telegram_chat_id));
    } catch {
      console.warn(`[getChatIds] invalid telegram_chat_id for user ${r.user_id}`);
    }
  }
  return map;
}

export async function getUserEmails(pool: Pool, userIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (userIds.length === 0) return map;
  const [rows] = await pool.query<EmailRow[]>(
    "SELECT id, email FROM users WHERE id IN (?) AND status = 'active'",
    [userIds],
  );
  for (const row of rows) {
    if (row.email) map.set(row.id, row.email);
  }
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

export async function sendEmailAndTrack(
  pool: ReturnType<typeof getDbPool> | Pool,
  notifId: number,
  to: string,
  subject: string,
  text: string,
  html?: string,
  sendEmail: SendEmailFn = sendEmailMessage,
) {
  await createEmailDelivery(pool, notifId);
  const sent = await sendEmail({ to, subject, text, html });
  await markDeliveryStatus(pool, notifId, "email", sent ? "sent" : "failed", {
    providerId: sent?.messageId,
  });
}

function addOpenLinkText(body: string, queueUrl: string): string {
  return `${body}\n\nเปิดใน E-Memo: ${queueUrl}`;
}

function addOpenLinkHtml(body: string, queueUrl: string): string {
  const escapedUrl = queueUrl
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `${body.replace(/\n/g, "<br>")}<br><br><a href="${escapedUrl}">เปิดใน E-Memo</a>`;
}

// Actionable: notify the approvers at the memo's current step, with an approve button.
// Returns the approver user ids so the caller can exclude them from the watcher fan-out.
async function notifyApprovers(memo: MemoRow, queuePath: string, queueUrl: string): Promise<number[]> {
  const pool = getDbPool();
  const recipientIds = await resolveApprovalStepRecipients(memo.current_step, pool);
  if (recipientIds.length === 0) return [];
  const chatIds = await getChatIds(pool, recipientIds);
  const emailEnabled = getEmailConfig() !== null;
  const emails = emailEnabled ? await getUserEmails(pool, recipientIds) : new Map<number, string>();
  const ctx = { memoNo: memo.memo_no, title: memo.title, requesterName: memo.requester_name, currentStep: memo.current_step };
  const body = buildMemoNotificationText("memo_pending_approval", ctx);
  const tgHtml = buildMemoNotificationHtml("memo_pending_approval", ctx);
  const title = buildMemoNotificationTitle("memo_pending_approval", memo.memo_no);
  for (const recipientUserId of recipientIds) {
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId, type: "memo_pending_approval",
      title, body, actionUrl: queuePath,
    });
    const chatId = chatIds.get(recipientUserId);
    if (chatId) {
      const { tokenDbId } = await createApproveActionToken(memo.id, recipientUserId, chatId, pool);
      await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard([[
        { text: "✅ อนุมัติ", callback_data: `approve:${tokenDbId}` },
        { text: "เปิดใน E-Memo", url: queueUrl },
      ]]));
    }
    const email = emails.get(recipientUserId);
    if (email) {
      await sendEmailAndTrack(pool, notifId, email, title,
        wrapEmailText(addOpenLinkText(body, queueUrl)),
        wrapEmailHtml(addOpenLinkHtml(tgHtml, queueUrl), { heading: title }));
    }
  }
  return recipientIds;
}

// Watcher (FYI): notify requester + individual CC. `submitted` keeps the actor
// (requester confirmation) and uses memo_submitted/memo_cc; other events exclude
// the actor and use a single shared type. excludeIds drops recipients already
// notified as actionable approvers (no double-notify).
async function notifyWatchers(
  memo: MemoRow,
  types: { requesterType: string; ccType: string },
  actorUserId: number | null,
  excludeActor: boolean,
  queuePath: string,
  queueUrl: string,
  excludeIds: number[] = [],
): Promise<void> {
  const pool = getDbPool();
  const requesterId = await resolveRequesterRecipient(memo.requester_name, memo.requester_user_id, pool);
  const ccIds = await resolveMemoCcRecipients(memo.id, memo.revision_no, pool);
  const recipients = computeWatcherRecipients({ requesterId, ccIds, actorId: actorUserId, excludeActor, excludeIds });
  if (recipients.length === 0) return;
  const chatIds = await getChatIds(pool, recipients);
  const emailEnabled = getEmailConfig() !== null;
  const emails = emailEnabled ? await getUserEmails(pool, recipients) : new Map<number, string>();
  const ctx = { memoNo: memo.memo_no, title: memo.title, requesterName: memo.requester_name, currentStep: memo.current_step };
  for (const userId of recipients) {
    const type = userId === requesterId ? types.requesterType : types.ccType;
    const body = buildMemoNotificationText(type, ctx);
    const tgHtml = buildMemoNotificationHtml(type, ctx);
    const title = buildMemoNotificationTitle(type, memo.memo_no);
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId: userId, type,
      title, body, actionUrl: queuePath,
    });
    const chatId = chatIds.get(userId);
    const email = emails.get(userId);
    if (email) {
      await sendEmailAndTrack(pool, notifId, email, title,
        wrapEmailText(addOpenLinkText(body, queueUrl)),
        wrapEmailHtml(addOpenLinkHtml(tgHtml, queueUrl), { heading: title }));
    }
    if (chatId) await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
  }
}

// Actionable-ish: tell the memo's still-pending Read recipients they must
// acknowledge it. Read is a blocking step (SA §6.2/6.3) — without this they'd
// only find out by opening the queue. No approve button; Read is its own action.
async function notifyReadRecipients(
  memo: MemoRow,
  queuePath: string,
  queueUrl: string,
  actorUserId: number | null,
): Promise<void> {
  const pool = getDbPool();
  const labels = await getPendingReadLabels(pool, memo.id, memo.revision_no);
  if (labels.length === 0) return;
  const readerIds = await resolveReadRecipientLabels(labels, pool);
  const recipients = computeReadNotifyRecipients({ readRecipientIds: readerIds, actorId: actorUserId });
  if (recipients.length === 0) return;
  const chatIds = await getChatIds(pool, recipients);
  const emailEnabled = getEmailConfig() !== null;
  const emails = emailEnabled ? await getUserEmails(pool, recipients) : new Map<number, string>();
  const ctx = { memoNo: memo.memo_no, title: memo.title, requesterName: memo.requester_name, currentStep: memo.current_step };
  const body = buildMemoNotificationText("memo_pending_read", ctx);
  const tgHtml = buildMemoNotificationHtml("memo_pending_read", ctx);
  const title = buildMemoNotificationTitle("memo_pending_read", memo.memo_no);
  for (const userId of recipients) {
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId: userId, type: "memo_pending_read",
      title, body, actionUrl: queuePath,
    });
    const email = emails.get(userId);
    if (email) {
      await sendEmailAndTrack(pool, notifId, email, title,
        wrapEmailText(addOpenLinkText(body, queueUrl)),
        wrapEmailHtml(addOpenLinkHtml(tgHtml, queueUrl), { heading: title }));
    }
    const chatId = chatIds.get(userId);
    if (chatId) await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
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
    const statusUpdate = { requesterType: "memo_status_update", ccType: "memo_status_update" };

    if (eventType === "submitted") {
      await notifyWatchers(memo, { requesterType: "memo_submitted", ccType: "memo_cc" }, actorUserId, false, queuePath, queueUrl);
      await notifyReadRecipients(memo, queuePath, queueUrl, actorUserId);
      return;
    }
    if (eventType === "resubmitted") {
      const approverIds = await notifyApprovers(memo, queuePath, queueUrl);
      await notifyWatchers(memo, statusUpdate, actorUserId, true, queuePath, queueUrl, approverIds);
      await notifyReadRecipients(memo, queuePath, queueUrl, actorUserId);
      return;
    }
    if (eventType === "advanced" && memo.status === "approved") {
      await notifyWatchers(memo, { requesterType: "memo_approved", ccType: "memo_approved" }, actorUserId, true, queuePath, queueUrl);
      return;
    }
    if (eventType === "advanced") {
      const approverIds = await notifyApprovers(memo, queuePath, queueUrl);
      await notifyWatchers(memo, statusUpdate, actorUserId, true, queuePath, queueUrl, approverIds);
      return;
    }
    // returned | rejected
    const type = eventType === "returned" ? "memo_returned" : "memo_rejected";
    await notifyWatchers(memo, { requesterType: type, ccType: type }, actorUserId, true, queuePath, queueUrl);
  } catch (err) {
    console.error("[notifyMemoEvent] non-fatal error:", err);
  }
}
