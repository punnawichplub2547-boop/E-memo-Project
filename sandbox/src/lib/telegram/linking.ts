import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { nowMysqlUtcDateTime } from "@/lib/workflow-rules";
import { createTokenExpiry, generateRawToken, hashToken, isTokenExpired } from "./tokens";

type LinkTokenRow = RowDataPacket & { id: number; user_id: number; expires_at: string; used_at: string | null };

export async function createLinkToken(userId: number, pool: Pool): Promise<string> {
  const rawToken = generateRawToken();
  const now = nowMysqlUtcDateTime();
  await pool.query(
    "INSERT INTO telegram_link_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [hashToken(rawToken), userId, nowMysqlUtcDateTime(createTokenExpiry(15)), now],
  );
  return rawToken;
}

export async function consumeLinkToken(rawToken: string, pool: Pool): Promise<{ userId: number } | null> {
  const [rows] = await pool.query<LinkTokenRow[]>(
    "SELECT id, user_id, expires_at, used_at FROM telegram_link_tokens WHERE token_hash = ? LIMIT 1",
    [hashToken(rawToken)],
  );
  const row = rows[0];
  if (!row || row.used_at !== null || isTokenExpired(row.expires_at)) return null;
  await pool.query("UPDATE telegram_link_tokens SET used_at = ? WHERE id = ?", [nowMysqlUtcDateTime(), row.id]);
  return { userId: row.user_id };
}

export async function upsertTelegramAccount(
  input: { userId: number; telegramUserId: bigint; chatId: bigint; username?: string; firstName?: string; lastName?: string },
  pool: Pool,
): Promise<void> {
  const now = nowMysqlUtcDateTime();
  await pool.query(
    "UPDATE user_telegram_accounts SET is_active = FALSE, revoked_at = ? WHERE user_id = ? AND is_active = TRUE",
    [now, input.userId],
  );
  await pool.query(
    `INSERT INTO user_telegram_accounts
       (user_id, telegram_user_id, telegram_chat_id, telegram_username, first_name, last_name, is_active, linked_at)
     VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), telegram_chat_id = VALUES(telegram_chat_id),
       telegram_username = VALUES(telegram_username), first_name = VALUES(first_name),
       last_name = VALUES(last_name), is_active = TRUE, linked_at = VALUES(linked_at), revoked_at = NULL`,
    [input.userId, input.telegramUserId, input.chatId, input.username ?? null, input.firstName ?? null, input.lastName ?? null, now],
  );
}

export async function revokeTelegramAccount(userId: number, pool: Pool): Promise<void> {
  await pool.query(
    "UPDATE user_telegram_accounts SET is_active = FALSE, revoked_at = ? WHERE user_id = ? AND is_active = TRUE",
    [nowMysqlUtcDateTime(), userId],
  );
}

export async function getActiveTelegramAccount(
  userId: number,
  pool: Pool,
): Promise<{ chatId: bigint; username: string | null; linkedAt: string } | null> {
  const [rows] = await pool.query<(RowDataPacket & { telegram_chat_id: string; telegram_username: string | null; linked_at: string })[]>(
    "SELECT telegram_chat_id, telegram_username, linked_at FROM user_telegram_accounts WHERE user_id = ? AND is_active = TRUE LIMIT 1",
    [userId],
  );
  if (!rows[0]) return null;
  return { chatId: BigInt(rows[0].telegram_chat_id), username: rows[0].telegram_username, linkedAt: rows[0].linked_at };
}
