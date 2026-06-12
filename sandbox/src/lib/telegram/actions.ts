import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { nowMysqlUtcDateTime } from "@/lib/workflow-rules";
import { createTokenExpiry, generateRawToken, hashToken } from "./tokens";

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
  // Atomic: telegram_user_id ownership, expiry, and used_at all checked in SQL.
  const [result] = await pool.query(
    `UPDATE telegram_action_tokens SET used_at = ?
     WHERE id = ? AND action_type = 'approve' AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.telegram_user_id')) = ?`,
    [nowMysqlUtcDateTime(), tokenDbId, telegramUserId.toString()],
  ) as [{ affectedRows: number }, unknown];
  if (result.affectedRows !== 1) return null;
  const [rows] = await pool.query<(RowDataPacket & { user_id: number; memo_no: string })[]>(
    `SELECT t.user_id, m.memo_no FROM telegram_action_tokens t
     JOIN memos m ON m.id = t.memo_id WHERE t.id = ? LIMIT 1`,
    [tokenDbId],
  );
  return rows[0] ? { memoNo: rows[0].memo_no, userId: rows[0].user_id } : null;
}
