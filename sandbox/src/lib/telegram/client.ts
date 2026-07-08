export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
    })) as { ok: boolean; result?: TelegramMessage; error_code?: number; description?: string };
    if (data.ok) return data.result ?? null;
    // Surface the API rejection reason — e.g. an invalid inline-button URL when
    // APP_PUBLIC_BASE_URL points at localhost — instead of failing silently.
    console.error(
      `[telegram] sendMessage rejected (error_code=${data.error_code ?? "?"}): ${data.description ?? "no description"}`,
    );
    return null;
  } catch (err) {
    console.error("[telegram] sendMessage failed:", err);
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
  } catch (err) {
    // Best-effort; must not throw to keep webhook response intact.
    console.error("[telegram] answerCallbackQuery failed:", err);
  }
}
