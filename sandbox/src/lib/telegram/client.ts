type TelegramButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };

export type InlineKeyboard = { inline_keyboard: TelegramButton[][] };
export type TelegramMessage = { message_id: number };

export function buildInlineKeyboard(rows: TelegramButton[][]): InlineKeyboard {
  return { inline_keyboard: rows };
}

async function telegramPost(method: string, body: object): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendTelegramMessage(
  chatId: bigint | number,
  text: string,
  options?: { replyMarkup?: InlineKeyboard },
): Promise<TelegramMessage | null> {
  try {
    const data = (await telegramPost("sendMessage", {
      chat_id: chatId.toString(),
      text,
      parse_mode: "HTML",
      ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    })) as { ok: boolean; result?: TelegramMessage };
    return data.ok ? (data.result ?? null) : null;
  } catch {
    return null;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  try {
    await telegramPost("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text, show_alert: showAlert } : {}),
    });
  } catch {
    // Best-effort; must not throw to keep webhook response intact.
  }
}
