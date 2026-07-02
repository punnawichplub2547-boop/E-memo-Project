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

export type ReviewTokenActionType =
  | "review_no_objection"
  | "review_escalate"
  | "review_comment_start"
  | "review_revision_start";

// Returns { tokenDbId } — caller puts "<actionType>:<tokenDbId>" in Telegram callback_data.
export async function createReviewActionToken(
  memoId: number,
  userId: number,
  telegramUserId: bigint,
  actionType: ReviewTokenActionType,
  pool: Pool,
): Promise<{ tokenDbId: number }> {
  const rawToken = generateRawToken();
  const now = nowMysqlUtcDateTime();
  const [result] = await pool.query(
    `INSERT INTO telegram_action_tokens (token_hash, memo_id, user_id, action_type, expires_at, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [hashToken(rawToken), memoId, userId, actionType, nowMysqlUtcDateTime(createTokenExpiry(30)), now,
     JSON.stringify({ telegram_user_id: telegramUserId.toString() })],
  ) as [{ insertId: number }, unknown];
  return { tokenDbId: result.insertId };
}

export async function consumeReviewActionToken(
  tokenDbId: number,
  telegramUserId: bigint,
  actionType: ReviewTokenActionType,
  pool: Pool,
): Promise<{ memoNo: string; userId: number; memoId: number } | null> {
  // Atomic: telegram_user_id ownership, expiry, action_type, and used_at all checked in SQL.
  const [result] = await pool.query(
    `UPDATE telegram_action_tokens SET used_at = ?
     WHERE id = ? AND action_type = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.telegram_user_id')) = ?`,
    [nowMysqlUtcDateTime(), tokenDbId, actionType, telegramUserId.toString()],
  ) as [{ affectedRows: number }, unknown];
  if (result.affectedRows !== 1) return null;
  const [rows] = await pool.query<(RowDataPacket & { user_id: number; memo_id: number; memo_no: string })[]>(
    `SELECT t.user_id, t.memo_id, m.memo_no FROM telegram_action_tokens t
     JOIN memos m ON m.id = t.memo_id WHERE t.id = ? LIMIT 1`,
    [tokenDbId],
  );
  return rows[0] ? { memoNo: rows[0].memo_no, userId: rows[0].user_id, memoId: rows[0].memo_id } : null;
}

export type ReviewConversationActionType = "review_comment" | "review_revision";

export async function createReviewConversationState(input: {
  telegramUserId: bigint;
  userId: number;
  memoId: number;
  actionType: ReviewConversationActionType;
  pool: Pool;
}): Promise<{ id: number }> {
  const now = nowMysqlUtcDateTime();
  const [result] = await input.pool.query(
    `INSERT INTO telegram_conversation_states
       (telegram_user_id, user_id, memo_id, action_type, state, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.telegramUserId.toString(), input.userId, input.memoId, input.actionType, "awaiting_text",
     nowMysqlUtcDateTime(createTokenExpiry(30)), now, now],
  ) as [{ insertId: number }, unknown];
  return { id: result.insertId };
}

export async function findActiveReviewConversationState(
  telegramUserId: bigint,
  pool: Pool,
): Promise<{ id: number; userId: number; memoId: number; memoNo: string; actionType: ReviewConversationActionType } | null> {
  const [rows] = await pool.query<(RowDataPacket & {
    id: number; user_id: number; memo_id: number; memo_no: string; action_type: ReviewConversationActionType;
  })[]>(
    `SELECT t.id, t.user_id, t.memo_id, m.memo_no, t.action_type
     FROM telegram_conversation_states t
     JOIN memos m ON m.id = t.memo_id
     WHERE t.telegram_user_id = ? AND t.expires_at > UTC_TIMESTAMP()
     ORDER BY t.created_at DESC LIMIT 1`,
    [telegramUserId.toString()],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, userId: row.user_id, memoId: row.memo_id, memoNo: row.memo_no, actionType: row.action_type };
}

export async function deleteReviewConversationState(
  id: number,
  telegramUserId: bigint,
  pool: Pool,
): Promise<void> {
  await pool.query(
    `DELETE FROM telegram_conversation_states WHERE id = ? AND telegram_user_id = ?`,
    [id, telegramUserId.toString()],
  );
}
