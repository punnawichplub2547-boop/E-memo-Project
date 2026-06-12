import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { findUserById } from "@/lib/db-users";
import { sendTelegramMessage, answerCallbackQuery } from "@/lib/telegram/client";
import { consumeLinkToken, upsertTelegramAccount } from "@/lib/telegram/linking";
import { consumeApproveActionToken } from "@/lib/telegram/actions";
import { approveMemoAction, WorkflowActionError } from "@/lib/workflow-actions";

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
  return !!secret && request.headers.get("x-telegram-bot-api-secret-token") === secret;
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
  await sendTelegramMessage(chatId, `✅ เชื่อมต่อ Telegram สำเร็จ\nสวัสดี ${user.first_name} ${user.last_name}\nคุณจะได้รับการแจ้งเตือน E-Memo ที่นี่`);
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
    await sendTelegramMessage(chatId, `✅ อนุมัติ ${result.memoNo} สำเร็จแล้ว`);
  } catch (err) {
    const msg = err instanceof WorkflowActionError ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
    await answerCallbackQuery(cqId, msg, true);
  }
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let update: TelegramUpdate;
  try { update = (await request.json()) as TelegramUpdate; }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  if (update.message?.text?.startsWith("/start ")) {
    const rawToken = update.message.text.slice(7).trim();
    if (rawToken) await handleStart(update, rawToken);
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
    } else {
      await answerCallbackQuery(cq.id, "ไม่รู้จักคำสั่งนี้");
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
