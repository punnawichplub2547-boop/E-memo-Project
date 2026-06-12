import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { nowMysqlUtcDateTime } from "@/lib/workflow-rules";
import { createTokenExpiry, generateRawToken, hashToken, isTokenExpired } from "./tokens";

type ActionTokenRow = RowDataPacket & {
  id: number;
  memo_id: number;
  memo_no: string;
  user_id: number;
  telegram_user_id_owner: string;
  expires_at: string;
  used_at: string | null;
};

// Returns { tokenDbId } — caller puts "approve:<tokenDbId>" in Telegram callback_data.
export async function createApproveActionToken(
  memoId: number,
  userId: number,
  telegramUserId: bigint,
  pool: Pool,
): Promise<{ tokenDbId: number }> {
  const rawToken = generateRawToken();
  const now = nowMysqlUtcDateTime();
  const [result] = await pool.query(
    `INSERT INTO telegram_action_tokens (token_hash, memo_id, user_id, action_type, expires_at, created_at, metadata_json)
     VALUES (?, ?, ?, 'approve', ?, ?, ?)`,
    [hashToken(rawToken), memoId, userId, nowMysqlUtcDateTime(createTokenExpiry(30)), now,
     JSON.stringify({ telegram_user_id: telegramUserId.toString() })],
  ) as [{ insertId: number }, unknown];
  return { tokenDbId: result.insertId };
}

export async function consumeApproveActionToken(
  tokenDbId: number,
  telegramUserId: bigint,
  pool: Pool,
): Promise<{ memoNo: string; userId: number } | null> {
  const [rows] = await pool.query<ActionTokenRow[]>(
    `SELECT t.id, t.memo_id, m.memo_no, t.user_id,
            JSON_UNQUOTE(JSON_EXTRACT(t.metadata_json, '$.telegram_user_id')) AS telegram_user_id_owner,
            t.expires_at, t.used_at
     FROM telegram_action_tokens t
     JOIN memos m ON m.id = t.memo_id
     WHERE t.id = ? AND t.action_type = 'approve' LIMIT 1`,
    [tokenDbId],
  );
  const row = rows[0];
  if (!row || row.used_at !== null || isTokenExpired(row.expires_at)) return null;
  if (row.telegram_user_id_owner !== telegramUserId.toString()) return null;
  await pool.query("UPDATE telegram_action_tokens SET used_at = ? WHERE id = ?", [nowMysqlUtcDateTime(), row.id]);
  return { memoNo: row.memo_no, userId: row.user_id };
}
