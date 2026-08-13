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
  type MemoNotificationContext,
} from "./notifications";
import { describeCustomStep, parseCustomRouteJson } from "./custom-route";
import {
  resolveApprovalStepRecipients,
  resolveRequesterRecipient,
  resolveMemoCcRecipients,
  resolveReadRecipientLabels,
} from "./notification-recipients";
import { sendTelegramMessage, buildInlineKeyboard, sendTelegramPhoto } from "./telegram/client";
import { createApproveActionToken, createReviewActionToken, type ReviewTokenActionType } from "./telegram/actions";
import { getEmailConfig, sendEmailMessage } from "./email/client";
import { wrapEmailHtml, wrapEmailText } from "./email/template";
import { loadNotifyNote, readNotifyNoteImageBuffers } from "./notify-note-store";
import {
  buildNotifyNoteText,
  buildNotifyNoteHtml,
  buildNotifyNoteEmailAttachments,
} from "./email/notify-note-section";
import { memoToExcelBuffer } from "./export/memo-excel";
import { loadMemoForExport } from "./export/load-memo-export";
import type { NotifyNote } from "./notify-note";
import type { EmailAttachment } from "./email/client";
import type { RowDataPacket } from "mysql2";

type MemoRow = RowDataPacket & {
  id: number; memo_no: string; title: string; requester_name: string;
  requester_user_id: number | null;
  department_name: string;
  current_step: string; status: string; revision_no: number;
  md_review_status: "pending" | "completed" | "escalated" | null;
  md_review_resume_step: string | null;
  // Optional: absent on legacy DBs that predate the custom-route migration.
  custom_route_json?: unknown;
};
type ChatRow = RowDataPacket & { user_id: number; telegram_chat_id: string };
type EmailRow = RowDataPacket & { id: number; email: string };
type SendEmailFn = typeof sendEmailMessage;

export type MemoEventType = "submitted" | "resubmitted" | "advanced" | "returned" | "rejected";

// Pure: short note ถูกส่งครั้งเดียวตอนส่งเมโมครั้งแรกเท่านั้น (Q16). เช็ค revisionNo
// ด้วยเพราะ note ผูกกับ "การส่งครั้งแรก" ไม่ใช่กับ event ชื่อ submitted เฉยๆ
export function shouldSendNotifyNote(eventType: MemoEventType, revisionNo: number): boolean {
  return eventType === "submitted" && revisionNo <= 1;
}

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
  for (const id of input.excludeIds ?? []) {
    // excludeIds exists to dedup an approver who is also a CC — it must never be able
    // to drop the actor when excludeActor is false, or a requester who happens to also
    // be resolved as their memo's own approver would silently lose their submission
    // confirmation (contradicting the caller's explicit excludeActor=false intent).
    if (!input.excludeActor && id === input.actorId) continue;
    set.delete(id);
  }
  return [...set];
}

// Pure: which MD-review buttons to show, in display order. Escalate is
// omitted when the resume step is already Managing Director (per the web
// drawer-footer's identical rule — acknowledging vs escalating would be the
// same outcome in that case, so escalate is redundant).
export function buildMdReviewButtonPlan(mdReviewResumeStep: string | null): ReviewTokenActionType[] {
  const base: ReviewTokenActionType[] = ["review_no_objection", "review_comment_start", "review_revision_start"];
  if (mdReviewResumeStep === "Managing Director") return base;
  return [...base, "review_escalate"];
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
    `SELECT id, memo_no, title, requester_name, requester_user_id, department_name,
            current_step, status, revision_no,
            md_review_status, md_review_resume_step, custom_route_json
     FROM memos WHERE memo_no = ? AND deleted_at IS NULL LIMIT 1`,
    [memoNo],
  );
  return rows[0] ?? null;
}

type NotifyNoteDelivery = {
  emailText: string;
  emailHtml: string;
  emailAttachments: EmailAttachment[];
  telegramPhotos: { content: Buffer; filename: string }[];
  inAppText: string;
};

// รวบ I/O ของ short note ไว้ที่เดียว: อ่าน DB → อ่านไฟล์รูป → (ถ้าติ๊กไว้) สร้าง Excel
// ทำครั้งเดียวต่อ 1 event แล้วใช้ซ้ำกับผู้รับทุกคน ไม่ใช่อ่านใหม่ต่อคน
async function loadNotifyNoteDelivery(memo: MemoRow): Promise<NotifyNoteDelivery | null> {
  const pool = getDbPool();
  const note: NotifyNote | null = await loadNotifyNote(pool, memo.id);
  if (!note) return null;

  const loadedImages = await readNotifyNoteImageBuffers(memo.memo_no, note.images);
  const emailAttachments = buildNotifyNoteEmailAttachments(loadedImages);

  // Q17: แนบ Excel เฉพาะเมื่อผู้สร้างติ๊กเอง · Q17b: อีเมลเท่านั้น ไม่ส่งเข้า Telegram
  if (note.attachExcel) {
    try {
      const loaded = await loadMemoForExport(memo.memo_no, pool);
      if (loaded) {
        const buffer = await memoToExcelBuffer(loaded.memo, loaded.signatures);
        const safeName = memo.memo_no.replace(/[^A-Za-z0-9_-]/g, "_");
        emailAttachments.push({ filename: `memo-${safeName}.xlsx`, content: buffer });
      }
    } catch (err) {
      // ไฟล์แนบพลาดได้ แต่การแจ้งเตือนต้องออก
      console.error("[loadNotifyNoteDelivery] excel attachment failed:", err);
    }
  }

  return {
    emailText: buildNotifyNoteText(note),
    emailHtml: buildNotifyNoteHtml(note, loadedImages.map((entry) => entry.image)),
    emailAttachments,
    telegramPhotos: loadedImages.map((entry) => ({
      content: entry.content,
      filename: entry.image.originalName,
    })),
    inAppText: buildNotifyNoteText(note),
  };
}

// Pure: the payload every outbound channel (in-app bell, Telegram, email) renders.
// current_step is a raw string in the DB — for a custom route that string is a
// token ("person:2#7"), which is machine plumbing and must never reach a human.
// Resolving it here, at the single place all three channels read from, is what
// keeps the token out of all of them at once.
export function buildMemoNotificationContext(
  memo: Pick<MemoRow, "memo_no" | "title" | "requester_name" | "current_step"> & { custom_route_json?: unknown },
): MemoNotificationContext {
  return {
    memoNo: memo.memo_no,
    title: memo.title,
    requesterName: memo.requester_name,
    currentStep: describeCustomStep(memo.current_step, parseCustomRouteJson(memo.custom_route_json ?? null)),
  };
}

// Pure: never send an actionable "please approve" notification (with a one-tap
// approve button) to the user who triggered this event — a person should not be
// prompted to approve their own action, e.g. a Manager submitting their own memo
// that routes to their own "Manager / Top Section" step.
export function excludeActorFromRecipients(recipientIds: number[], actorUserId: number | null): number[] {
  if (actorUserId == null) return recipientIds;
  return recipientIds.filter(id => id !== actorUserId);
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
  attachments?: EmailAttachment[],
) {
  await createEmailDelivery(pool, notifId);
  const sent = await sendEmail({ to, subject, text, html, ...(attachments?.length ? { attachments } : {}) });
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

const BUTTON_LABELS: Record<ReviewTokenActionType, string> = {
  review_no_objection: "✅ ไม่มีข้อโต้แย้ง",
  review_comment_start: "💬 แสดงความเห็น",
  review_revision_start: "✏️ ขอแก้ไข",
  review_escalate: "⤴️ ยกระดับเป็นผู้อนุมัติ",
};

// Actionable: notify the approvers at the memo's current step, with an approve button.
// Returns the approver user ids so the caller can exclude them from the watcher fan-out.
// actorUserId is excluded from the recipients — see excludeActorFromRecipients.
async function notifyApprovers(
  memo: MemoRow,
  queuePath: string,
  queueUrl: string,
  actorUserId: number | null,
  note?: NotifyNoteDelivery | null,
): Promise<number[]> {
  const pool = getDbPool();
  const allRecipientIds = await resolveApprovalStepRecipients(memo.current_step, memo.department_name, pool);
  const recipientIds = excludeActorFromRecipients(allRecipientIds, actorUserId);
  if (recipientIds.length === 0) return [];
  const chatIds = await getChatIds(pool, recipientIds);
  const emailEnabled = getEmailConfig() !== null;
  const emails = emailEnabled ? await getUserEmails(pool, recipientIds) : new Map<number, string>();
  const isMdReviewPending = memo.md_review_status === "pending";
  const notifType = isMdReviewPending ? "memo_md_review_pending" : "memo_pending_approval";
  const ctx = buildMemoNotificationContext(memo);
  const body = buildMemoNotificationText(notifType, ctx);
  const tgHtml = buildMemoNotificationHtml(notifType, ctx);
  const title = buildMemoNotificationTitle(notifType, memo.memo_no);
  // in-app: ต่อท้าย body ด้วยข้อความ note (ไม่มีรูป — กระดิ่งเป็นข้อความล้วน)
  const bodyWithNote = note?.inAppText ? `${body}\n\n${note.inAppText}` : body;
  for (const recipientUserId of recipientIds) {
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId, type: notifType,
      title, body: bodyWithNote, actionUrl: queuePath,
    });
    const chatId = chatIds.get(recipientUserId);
    if (chatId) {
      if (isMdReviewPending) {
        const actions = buildMdReviewButtonPlan(memo.md_review_resume_step);
        const buttons: { text: string; callback_data: string }[] = [];
        for (const actionType of actions) {
          const { tokenDbId } = await createReviewActionToken(memo.id, recipientUserId, chatId, actionType, pool);
          buttons.push({ text: BUTTON_LABELS[actionType], callback_data: `${actionType}:${tokenDbId}` });
        }
        const rows = [buttons.slice(0, 2), buttons.slice(2), [{ text: "เปิดใน E-Memo", url: queueUrl }]]
          .filter((row) => row.length > 0);
        await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard(rows));
      } else {
        const { tokenDbId } = await createApproveActionToken(memo.id, recipientUserId, chatId, pool);
        await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard([[
          { text: "✅ อนุมัติ", callback_data: `approve:${tokenDbId}` },
          { text: "เปิดใน E-Memo", url: queueUrl },
        ]]));
      }
      // Q20: Telegram แตกเป็นหลายข้อความได้ — ข้อความหลักไปก่อน แล้วรูปตามทีละใบ
      for (const photo of note?.telegramPhotos ?? []) {
        await sendTelegramPhoto(chatId, photo.content, photo.filename);
      }
    }
    const email = emails.get(recipientUserId);
    if (email) {
      await sendEmailAndTrack(pool, notifId, email, title,
        wrapEmailText(addOpenLinkText(note?.emailText ? `${body}\n\n${note.emailText}` : body, queueUrl)),
        wrapEmailHtml(addOpenLinkHtml(tgHtml, queueUrl) + (note?.emailHtml ?? ""), { heading: title }),
        sendEmailMessage,
        note?.emailAttachments);
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
  note?: NotifyNoteDelivery | null,
): Promise<void> {
  const pool = getDbPool();
  const requesterId = await resolveRequesterRecipient(memo.requester_name, memo.requester_user_id, pool);
  const ccIds = await resolveMemoCcRecipients(memo.id, memo.revision_no, pool);
  const recipients = computeWatcherRecipients({ requesterId, ccIds, actorId: actorUserId, excludeActor, excludeIds });
  if (recipients.length === 0) return;
  const chatIds = await getChatIds(pool, recipients);
  const emailEnabled = getEmailConfig() !== null;
  const emails = emailEnabled ? await getUserEmails(pool, recipients) : new Map<number, string>();
  const ctx = buildMemoNotificationContext(memo);
  for (const userId of recipients) {
    const type = userId === requesterId ? types.requesterType : types.ccType;
    const body = buildMemoNotificationText(type, ctx);
    const tgHtml = buildMemoNotificationHtml(type, ctx);
    const title = buildMemoNotificationTitle(type, memo.memo_no);
    // in-app: ต่อท้าย body ด้วยข้อความ note (ไม่มีรูป — กระดิ่งเป็นข้อความล้วน)
    const bodyWithNote = note?.inAppText ? `${body}\n\n${note.inAppText}` : body;
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId: userId, type,
      title, body: bodyWithNote, actionUrl: queuePath,
    });
    const chatId = chatIds.get(userId);
    const email = emails.get(userId);
    if (email) {
      await sendEmailAndTrack(pool, notifId, email, title,
        wrapEmailText(addOpenLinkText(note?.emailText ? `${body}\n\n${note.emailText}` : body, queueUrl)),
        wrapEmailHtml(addOpenLinkHtml(tgHtml, queueUrl) + (note?.emailHtml ?? ""), { heading: title }),
        sendEmailMessage,
        note?.emailAttachments);
    }
    if (chatId) {
      await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
      // Q20: Telegram แตกเป็นหลายข้อความได้ — ข้อความหลักไปก่อน แล้วรูปตามทีละใบ
      for (const photo of note?.telegramPhotos ?? []) {
        await sendTelegramPhoto(chatId, photo.content, photo.filename);
      }
    }
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
  note?: NotifyNoteDelivery | null,
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
  const ctx = buildMemoNotificationContext(memo);
  const body = buildMemoNotificationText("memo_pending_read", ctx);
  const tgHtml = buildMemoNotificationHtml("memo_pending_read", ctx);
  const title = buildMemoNotificationTitle("memo_pending_read", memo.memo_no);
  // in-app: ต่อท้าย body ด้วยข้อความ note (ไม่มีรูป — กระดิ่งเป็นข้อความล้วน)
  const bodyWithNote = note?.inAppText ? `${body}\n\n${note.inAppText}` : body;
  for (const userId of recipients) {
    const notifId = await createNotification(pool, {
      memoId: memo.id, recipientUserId: userId, type: "memo_pending_read",
      title, body: bodyWithNote, actionUrl: queuePath,
    });
    const email = emails.get(userId);
    if (email) {
      await sendEmailAndTrack(pool, notifId, email, title,
        wrapEmailText(addOpenLinkText(note?.emailText ? `${body}\n\n${note.emailText}` : body, queueUrl)),
        wrapEmailHtml(addOpenLinkHtml(tgHtml, queueUrl) + (note?.emailHtml ?? ""), { heading: title }),
        sendEmailMessage,
        note?.emailAttachments);
    }
    const chatId = chatIds.get(userId);
    if (chatId) {
      await sendAndTrack(pool, notifId, chatId, tgHtml, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
      // Q20: Telegram แตกเป็นหลายข้อความได้ — ข้อความหลักไปก่อน แล้วรูปตามทีละใบ
      for (const photo of note?.telegramPhotos ?? []) {
        await sendTelegramPhoto(chatId, photo.content, photo.filename);
      }
    }
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
      // Defensive: loadNotifyNoteDelivery's own sub-calls already swallow their
      // expected failure modes (DB error, unreadable image, Excel export throw),
      // but a note failure must never sink the whole event via the outer catch —
      // that would silently skip the approver/watcher/read notifications too.
      const note = shouldSendNotifyNote(eventType, memo.revision_no)
        ? await loadNotifyNoteDelivery(memo).catch((err: unknown) => {
            console.error("[notifyMemoEvent] note delivery failed:", err);
            return null;
          })
        : null;
      const approverIds = await notifyApprovers(memo, queuePath, queueUrl, actorUserId, note);
      await notifyWatchers(memo, { requesterType: "memo_submitted", ccType: "memo_cc" }, actorUserId, false, queuePath, queueUrl, approverIds, note);
      await notifyReadRecipients(memo, queuePath, queueUrl, actorUserId, note);
      return;
    }
    if (eventType === "resubmitted") {
      const approverIds = await notifyApprovers(memo, queuePath, queueUrl, actorUserId);
      await notifyWatchers(memo, statusUpdate, actorUserId, true, queuePath, queueUrl, approverIds);
      await notifyReadRecipients(memo, queuePath, queueUrl, actorUserId);
      return;
    }
    if (eventType === "advanced" && memo.status === "approved") {
      await notifyWatchers(memo, { requesterType: "memo_approved", ccType: "memo_approved" }, actorUserId, true, queuePath, queueUrl);
      return;
    }
    if (eventType === "advanced") {
      const approverIds = await notifyApprovers(memo, queuePath, queueUrl, actorUserId);
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
