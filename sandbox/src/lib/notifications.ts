import type { Pool } from "mysql2/promise";
import { nowMysqlUtcDateTime } from "./workflow-rules";

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
};

export function buildMemoNotificationText(
  type: string,
  memo: MemoNotificationContext,
): string {
  const label = TYPE_LABELS[type] ?? type;
  return [
    `<b>E-Memo: ${label}</b>`,
    `เลขที่: ${memo.memoNo}`,
    `เรื่อง: ${memo.title}`,
    `ผู้ขอ: ${memo.requesterName}`,
    `สถานะ: ${label} (${memo.currentStep})`,
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
