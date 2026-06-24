import type { Pool } from "mysql2/promise";
import { nowMysqlUtcDateTime } from "./workflow-rules";
import { escHtml } from "./telegram/client";

export type MemoNotificationContext = {
  memoNo: string;
  title: string;
  requesterName: string;
  currentStep: string;
};

const TYPE_LABELS: Record<string, string> = {
  memo_pending_approval: "รออนุมัติ",
  memo_pending_read:     "รอรับทราบ",
  memo_cc:               "แจ้งเพื่อทราบ",
  memo_returned:         "ส่งคืนแก้ไข",
  memo_rejected:         "ปฏิเสธ",
  memo_approved:         "อนุมัติแล้ว",
  memo_submitted:        "ส่งเข้าระบบแล้ว",
  memo_status_update:    "อัปเดตสถานะ",
  user_issue_report:     "แจ้งปัญหาจากผู้ใช้",
};

// Builds the in-app notification shown to every admin when a user reports a usage
// problem from their profile page. There is no detail page for reports, so the
// full context (reporter + description) lives in the body.
export function buildIssueReportNotification(input: {
  reporterName: string;
  department: string;
  email: string;
  description: string;
}): { title: string; body: string } {
  const reporterName = input.reporterName.trim() || "ไม่ระบุชื่อ";
  const title = `แจ้งปัญหา: ${reporterName}`;
  const body = [
    "ผู้ใช้แจ้งปัญหาการใช้งาน",
    `ผู้แจ้ง: ${reporterName}`,
    `แผนก: ${input.department}`,
    `อีเมล: ${input.email}`,
    "รายละเอียด:",
    input.description.trim(),
  ].join("\n");
  return { title, body };
}

export function buildMemoNotificationTitle(type: string, memoNo: string): string {
  return `${TYPE_LABELS[type] ?? type}: ${memoNo}`;
}

export function buildMemoNotificationText(
  type: string,
  memo: MemoNotificationContext,
): string {
  const label = TYPE_LABELS[type] ?? type;
  return [
    `E-Memo: ${label}`,
    `เลขที่: ${memo.memoNo}`,
    `เรื่อง: ${memo.title}`,
    `ผู้ขอ: ${memo.requesterName}`,
    `สถานะ: ${label} (${memo.currentStep})`,
  ].join("\n");
}

export function buildMemoNotificationHtml(
  type: string,
  memo: MemoNotificationContext,
): string {
  const label = TYPE_LABELS[type] ?? type;
  return [
    `<b>E-Memo: ${escHtml(label)}</b>`,
    `เลขที่: ${escHtml(memo.memoNo)}`,
    `เรื่อง: ${escHtml(memo.title)}`,
    `ผู้ขอ: ${escHtml(memo.requesterName)}`,
    `สถานะ: ${escHtml(label)} (${escHtml(memo.currentStep)})`,
  ].join("\n");
}

export async function createNotification(
  pool: Pool,
  input: {
    memoId: number | null;
    recipientUserId: number;
    type: string;
    title: string;
    body?: string;
    actionUrl?: string;
  },
): Promise<number> {
  const now = nowMysqlUtcDateTime();
  const [result] = await pool.query(
    `INSERT INTO notifications (memo_id, recipient_user_id, notification_type, title, body, action_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.memoId, input.recipientUserId, input.type, input.title, input.body ?? null, input.actionUrl ?? null, now],
  ) as [{ insertId: number }, unknown];
  return result.insertId;
}

export type NotificationRow = {
  id: number;
  memoId: number | null;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

type RawNotificationRow = {
  id: number;
  memo_id: number | null;
  notification_type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: number | boolean;
  read_at: string | null;
  created_at: string;
};

function mapNotificationRow(row: RawNotificationRow): NotificationRow {
  return {
    id: Number(row.id),
    memoId: row.memo_id === null ? null : Number(row.memo_id),
    type: row.notification_type,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// Parses the ?limit query param. Falls back to 20 for missing / non-numeric /
// zero / negative input. listNotificationsForUser additionally clamps to [1,50].
export function parseNotificationLimit(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

// Returns the recipient's most recent notifications plus their unread count.
// Ownership is enforced by `recipient_user_id = ?` — callers pass the session user id.
export async function listNotificationsForUser(
  pool: Pool,
  recipientUserId: number,
  limit = 20,
): Promise<{ notifications: NotificationRow[]; unreadCount: number }> {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), 50);
  // SAFE to interpolate ONLY because safeLimit is clamped to an integer in [1,50]
  // above — it can never be a string. Do NOT copy this pattern for any value that
  // isn't similarly clamped (mysql2 rejects `LIMIT ?` placeholders by default).
  const [rows] = (await pool.query(
    `SELECT id, memo_id, notification_type, title, body, action_url, is_read, read_at, created_at
     FROM notifications
     WHERE recipient_user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ${safeLimit}`,
    [recipientUserId],
  )) as [RawNotificationRow[], unknown];
  const [countRows] = (await pool.query(
    `SELECT COUNT(*) AS unread FROM notifications WHERE recipient_user_id = ? AND is_read = FALSE`,
    [recipientUserId],
  )) as [Array<{ unread: number }>, unknown];
  return {
    notifications: rows.map(mapNotificationRow),
    unreadCount: Number(countRows[0]?.unread ?? 0),
  };
}

// Marks a single notification read; the recipient guard prevents marking another user's row.
// Returns true only when a still-unread row owned by the user was updated.
export async function markNotificationRead(
  pool: Pool,
  recipientUserId: number,
  notificationId: number,
): Promise<boolean> {
  const now = nowMysqlUtcDateTime();
  const [result] = (await pool.query(
    `UPDATE notifications SET is_read = TRUE, read_at = ?
     WHERE id = ? AND recipient_user_id = ? AND is_read = FALSE`,
    [now, notificationId, recipientUserId],
  )) as [{ affectedRows: number }, unknown];
  return result.affectedRows > 0;
}

// Marks every unread notification owned by the user as read; returns the count updated.
export async function markAllNotificationsRead(
  pool: Pool,
  recipientUserId: number,
): Promise<number> {
  const now = nowMysqlUtcDateTime();
  const [result] = (await pool.query(
    `UPDATE notifications SET is_read = TRUE, read_at = ?
     WHERE recipient_user_id = ? AND is_read = FALSE`,
    [now, recipientUserId],
  )) as [{ affectedRows: number }, unknown];
  return result.affectedRows;
}

export async function createTelegramDelivery(
  pool: Pool,
  notificationId: number,
): Promise<void> {
  const now = nowMysqlUtcDateTime();
  await pool.query(
    `INSERT INTO notification_deliveries (notification_id, channel, status, created_at) VALUES (?, 'telegram', 'pending', ?)`,
    [notificationId, now],
  );
}

export async function markDeliveryStatus(
  pool: Pool,
  notificationId: number,
  channel: string,
  status: "sent" | "failed" | "skipped",
  options?: { providerId?: string; error?: string },
): Promise<void> {
  const now = nowMysqlUtcDateTime();
  await pool.query(
    `UPDATE notification_deliveries
     SET status = ?, provider_message_id = ?, error_message = ?, attempted_at = ?, sent_at = ?
     WHERE notification_id = ? AND channel = ?`,
    [status, options?.providerId ?? null, options?.error ?? null, now, status === "sent" ? now : null, notificationId, channel],
  );
}
