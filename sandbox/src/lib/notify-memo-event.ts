// Fire-and-forget dispatcher. Never throws. Workflow must not be blocked by notification failures.
import { getDbPool } from "./db";
import { buildMemoNotificationText, createNotification, createTelegramDelivery, markDeliveryStatus } from "./notifications";
import { resolveApprovalStepRecipients, resolveRequesterRecipient } from "./notification-recipients";
import { sendTelegramMessage, buildInlineKeyboard } from "./telegram/client";
import { createApproveActionToken } from "./telegram/actions";
import type { RowDataPacket } from "mysql2";

type MemoRow = RowDataPacket & {
  id: number; memo_no: string; title: string; requester_name: string; current_step: string; status: string;
};
type ChatRow = RowDataPacket & { telegram_chat_id: string };

async function getMemo(memoNo: string) {
  const pool = getDbPool();
  const [rows] = await pool.query<MemoRow[]>(
    "SELECT id, memo_no, title, requester_name, current_step, status FROM memos WHERE memo_no = ? LIMIT 1",
    [memoNo],
  );
  return rows[0] ?? null;
}

async function getChatId(userId: number): Promise<bigint | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<ChatRow[]>(
    "SELECT telegram_chat_id FROM user_telegram_accounts WHERE user_id = ? AND is_active = TRUE LIMIT 1",
    [userId],
  );
  return rows[0] ? BigInt(rows[0].telegram_chat_id) : null;
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

export async function notifyMemoEvent(
  memoNo: string,
  eventType: "advanced" | "returned" | "rejected",
): Promise<void> {
  try {
    const pool = getDbPool();
    const memo = await getMemo(memoNo);
    if (!memo) return;

    const appUrl = process.env.APP_PUBLIC_BASE_URL ?? "http://localhost:3000";
    // In-app notifications store a relative path (deep-linked to the memo) so the
    // bell never navigates off-origin. Telegram buttons need an absolute URL.
    const queuePath = `/queue?memo=${encodeURIComponent(memo.memo_no)}`;
    const queueUrl = `${appUrl}${queuePath}`;
    const ctx = { memoNo: memo.memo_no, title: memo.title, requesterName: memo.requester_name, currentStep: memo.current_step };

    if (eventType === "advanced" && memo.status === "approved") {
      // Final step was just approved — notify requester
      const requesterId = await resolveRequesterRecipient(memo.requester_name, pool);
      if (requesterId) {
        const text = buildMemoNotificationText("memo_approved", ctx);
        const notifId = await createNotification(pool, { memoId: memo.id, recipientUserId: requesterId, type: "memo_approved", title: `อนุมัติแล้ว: ${memo.memo_no}`, body: text, actionUrl: queuePath });
        const chatId = await getChatId(requesterId);
        if (chatId) await sendAndTrack(pool, notifId, chatId, text, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
      }
      return;
    }

    if (eventType === "advanced") {
      // Intermediate step — notify next approvers with Approve button
      const recipientIds = await resolveApprovalStepRecipients(memo.current_step, pool);
      for (const recipientUserId of recipientIds) {
        const text = buildMemoNotificationText("memo_pending_approval", ctx);
        const notifId = await createNotification(pool, { memoId: memo.id, recipientUserId, type: "memo_pending_approval", title: `รออนุมัติ: ${memo.memo_no}`, body: text, actionUrl: queuePath });
        const chatId = await getChatId(recipientUserId);
        if (chatId) {
          const { tokenDbId } = await createApproveActionToken(memo.id, recipientUserId, chatId, pool);
          await sendAndTrack(pool, notifId, chatId, text, buildInlineKeyboard([[
            { text: "✅ อนุมัติ", callback_data: `approve:${tokenDbId}` },
            { text: "เปิดใน E-Memo", url: queueUrl },
          ]]));
        }
      }
      return;
    }

    // returned / rejected — notify requester
    const type = eventType === "returned" ? "memo_returned" : "memo_rejected";
    const label = eventType === "returned" ? "ส่งคืนแก้ไข" : "ปฏิเสธ";
    const requesterId = await resolveRequesterRecipient(memo.requester_name, pool);
    if (requesterId) {
      const text = buildMemoNotificationText(type, ctx);
      const notifId = await createNotification(pool, { memoId: memo.id, recipientUserId: requesterId, type, title: `${label}: ${memo.memo_no}`, body: text, actionUrl: queuePath });
      const chatId = await getChatId(requesterId);
      if (chatId) await sendAndTrack(pool, notifId, chatId, text, buildInlineKeyboard([[{ text: "เปิดใน E-Memo", url: queueUrl }]]));
    }
  } catch (err) {
    console.error("[notifyMemoEvent] non-fatal error:", err);
  }
}
