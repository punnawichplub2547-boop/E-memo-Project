import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { findUserById } from "@/lib/db-users";
import { sendTelegramMessage, answerCallbackQuery, escHtml, buildInlineKeyboard } from "@/lib/telegram/client";
import { consumeLinkToken, upsertTelegramAccount } from "@/lib/telegram/linking";
import {
  consumeApproveActionToken,
  consumeReviewActionToken,
  createReviewConversationState,
  deleteReviewConversationState,
  findActiveReviewConversationState,
  type ReviewConversationActionType,
} from "@/lib/telegram/actions";
import { isFromTelegramIp } from "@/lib/telegram/ip-allowlist";
import { approveMemoAction, reviewMemoAction, WorkflowActionError } from "@/lib/workflow-actions";
import type { ReviewResponse } from "@/lib/workflow-rules";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number } };
    data?: string;
  };
};

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (header.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(header, "utf8"), Buffer.from(secret, "utf8"));
  } catch {
    return false;
  }
}

async function handleStart(update: TelegramUpdate, rawToken: string): Promise<void> {
  const msg = update.message!;
  const chatId = BigInt(msg.chat.id);
  const from = msg.from;
  if (!from) return;

  const pool = getDbPool();
  const result = await consumeLinkToken(rawToken, pool);
  if (!result) {
    await sendTelegramMessage(chatId, "ลิงก์หมดอายุหรือถูกใช้แล้ว\nกรุณาสร้างลิงก์ใหม่จากหน้า Profile ใน E-Memo");
    return;
  }
  const user = await findUserById(result.userId);
  if (!user || user.status !== "active") {
    await sendTelegramMessage(chatId, "บัญชี E-Memo ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    return;
  }
  await upsertTelegramAccount(
    { userId: user.id, telegramUserId: BigInt(from.id), chatId, username: from.username, firstName: from.first_name, lastName: from.last_name },
    pool,
  );
  await sendTelegramMessage(chatId, `✅ เชื่อมต่อ Telegram สำเร็จ\nสวัสดี ${escHtml(user.first_name)} ${escHtml(user.last_name)}\nคุณจะได้รับการแจ้งเตือน E-Memo ที่นี่`);
}

async function handleApproveCallback(cqId: string, tokenDbId: number, telegramUserId: bigint, chatId: bigint): Promise<void> {
  const pool = getDbPool();
  const result = await consumeApproveActionToken(tokenDbId, telegramUserId, pool);
  if (!result) {
    await answerCallbackQuery(cqId, "การดำเนินการหมดอายุหรือถูกใช้แล้ว", true);
    return;
  }
  try {
    await approveMemoAction({
      memoNo: result.memoNo,
      actorUserId: result.userId,
      source: "telegram",
      metadata: { telegram_user_id: telegramUserId.toString(), telegram_chat_id: chatId.toString() },
    });
    await answerCallbackQuery(cqId, "อนุมัติสำเร็จ ✅");
    await sendTelegramMessage(chatId, `✅ อนุมัติ ${escHtml(result.memoNo)} สำเร็จแล้ว`);
  } catch (err) {
    const msg = err instanceof WorkflowActionError ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
    await answerCallbackQuery(cqId, msg, true);
  }
}

async function handleReviewActionCallback(
  cqId: string,
  actionType: "review_no_objection" | "review_escalate",
  tokenDbId: number,
  telegramUserId: bigint,
  chatId: bigint,
): Promise<void> {
  const pool = getDbPool();
  const result = await consumeReviewActionToken(tokenDbId, telegramUserId, actionType, pool);
  if (!result) {
    await answerCallbackQuery(cqId, "การดำเนินการหมดอายุหรือถูกใช้แล้ว", true);
    return;
  }
  const response: ReviewResponse =
    actionType === "review_no_objection" ? "acknowledged_no_objection" : "escalate_to_md_approval";
  try {
    await reviewMemoAction({
      memoNo: result.memoNo,
      actorUserId: result.userId,
      response,
      source: "telegram",
      metadata: { telegram_user_id: telegramUserId.toString(), telegram_chat_id: chatId.toString() },
    });
    await answerCallbackQuery(cqId, "บันทึกผลการพิจารณาสำเร็จ ✅");
    const successText = response === "acknowledged_no_objection"
      ? `✅ บันทึกว่าไม่มีข้อโต้แย้งสำหรับ ${escHtml(result.memoNo)} แล้ว`
      : `✅ ยกระดับเป็นผู้อนุมัติสำหรับ ${escHtml(result.memoNo)} แล้ว`;
    await sendTelegramMessage(chatId, successText);
  } catch (err) {
    const msg = err instanceof WorkflowActionError ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
    await answerCallbackQuery(cqId, msg, true);
  }
}

async function handleReviewStartCallback(
  cqId: string,
  actionType: "review_comment_start" | "review_revision_start",
  tokenDbId: number,
  telegramUserId: bigint,
  chatId: bigint,
): Promise<void> {
  const pool = getDbPool();
  const result = await consumeReviewActionToken(tokenDbId, telegramUserId, actionType, pool);
  if (!result) {
    await answerCallbackQuery(cqId, "การดำเนินการหมดอายุหรือถูกใช้แล้ว", true);
    return;
  }
  const conversationActionType: ReviewConversationActionType =
    actionType === "review_comment_start" ? "review_comment" : "review_revision";
  const { id: stateId } = await createReviewConversationState({
    telegramUserId, userId: result.userId, memoId: result.memoId, actionType: conversationActionType, pool,
  });
  await answerCallbackQuery(cqId);
  const prompt = conversationActionType === "review_comment"
    ? `กรุณาพิมพ์ความเห็นของคุณสำหรับ ${escHtml(result.memoNo)}`
    : `กรุณาพิมพ์เหตุผลที่ต้องการให้แก้ไขสำหรับ ${escHtml(result.memoNo)}`;
  await sendTelegramMessage(chatId, prompt, {
    replyMarkup: buildInlineKeyboard([[{ text: "ยกเลิก", callback_data: `review_cancel:${stateId}` }]]),
  });
}

async function handleReviewTextReply(text: string, telegramUserId: bigint, chatId: bigint): Promise<void> {
  const pool = getDbPool();
  const state = await findActiveReviewConversationState(telegramUserId, pool);
  if (!state) return; // no pending conversation — stay silent, same as any other unrecognized update
  await deleteReviewConversationState(state.id, telegramUserId, pool);
  const response: ReviewResponse = state.actionType === "review_comment" ? "comment" : "request_revision";
  try {
    await reviewMemoAction({
      memoNo: state.memoNo,
      actorUserId: state.userId,
      response,
      ...(response === "comment" ? { comment: text } : { reason: text }),
      source: "telegram",
      metadata: { telegram_user_id: telegramUserId.toString(), telegram_chat_id: chatId.toString() },
    });
    const successText = response === "comment"
      ? `✅ บันทึกความเห็นสำหรับ ${escHtml(state.memoNo)} แล้ว`
      : `✅ ส่งคำขอแก้ไขสำหรับ ${escHtml(state.memoNo)} กลับไปยังผู้ร้องขอแล้ว`;
    await sendTelegramMessage(chatId, successText);
  } catch (err) {
    const msg = err instanceof WorkflowActionError ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
    await sendTelegramMessage(chatId, msg);
  }
}

export async function POST(request: NextRequest) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && !isFromTelegramIp(cfIp)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!verifySecret(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let update: TelegramUpdate;
  try { update = (await request.json()) as TelegramUpdate; }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  try {
    if (update.message?.text?.startsWith("/start ")) {
      const rawToken = update.message.text.slice(7).trim();
      if (rawToken) await handleStart(update, rawToken);
      return NextResponse.json({ ok: true });
    }

    if (update.message?.text && !update.message.text.startsWith("/start")) {
      const from = update.message.from;
      if (from) {
        await handleReviewTextReply(update.message.text, BigInt(from.id), BigInt(update.message.chat.id));
      }
      return NextResponse.json({ ok: true });
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = BigInt(cq.message?.chat.id ?? 0);
      const telegramUserId = BigInt(cq.from.id);
      const data = cq.data ?? "";
      if (data.startsWith("approve:")) {
        const tokenDbId = parseInt(data.slice(8), 10);
        if (!isNaN(tokenDbId)) await handleApproveCallback(cq.id, tokenDbId, telegramUserId, chatId);
      } else if (data.startsWith("review_no_objection:") || data.startsWith("review_escalate:")) {
        const [prefix, idStr] = data.split(":");
        const tokenDbId = parseInt(idStr, 10);
        if (!isNaN(tokenDbId)) {
          await handleReviewActionCallback(
            cq.id, prefix as "review_no_objection" | "review_escalate", tokenDbId, telegramUserId, chatId,
          );
        }
      } else if (data.startsWith("review_comment_start:") || data.startsWith("review_revision_start:")) {
        const [prefix, idStr] = data.split(":");
        const tokenDbId = parseInt(idStr, 10);
        if (!isNaN(tokenDbId)) {
          await handleReviewStartCallback(
            cq.id, prefix as "review_comment_start" | "review_revision_start", tokenDbId, telegramUserId, chatId,
          );
        }
      } else if (data.startsWith("review_cancel:")) {
        const stateId = parseInt(data.slice("review_cancel:".length), 10);
        if (!isNaN(stateId)) {
          await deleteReviewConversationState(stateId, telegramUserId, getDbPool());
          await answerCallbackQuery(cq.id, "ยกเลิกแล้ว");
        }
      } else {
        await answerCallbackQuery(cq.id, "ไม่รู้จักคำสั่งนี้");
      }
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[telegram/webhook] unexpected error:", err);
  }

  return NextResponse.json({ ok: true });
}
