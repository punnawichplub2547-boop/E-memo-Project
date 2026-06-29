import type { RowDataPacket } from "mysql2";
import { getDbPool } from "./db";
import { generateRawToken, hashToken, createTokenExpiry } from "./telegram/tokens";

// Reset tokens live ~60 minutes; single-use.
export const RESET_TOKEN_TTL_MINUTES = 60;

// Minimum gap between reset requests for the same account. Defense-in-depth
// against forgot-password spam (Cloudflare WAF rate-limit is the edge primary).
export const RESET_COOLDOWN_MINUTES = 2;

export type ResetTokenRow = {
  expires_at: string | Date;
  used_at: string | Date | null;
};

type ResetTokenLookupRow = RowDataPacket & {
  id: number;
  user_id: number;
  expires_at: string;
  used_at: string | null;
};

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(String(value).replace(" ", "T") + "Z");
}

// Pure: a token is usable only if it exists, is unused, and has not expired.
export function isResetTokenUsable(
  row: ResetTokenRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row) return false;
  if (row.used_at != null) return false;
  return toDate(row.expires_at).getTime() > now.getTime();
}

// Issues a fresh single-use reset token for a user. Returns the raw token (emailed to the user);
// only its sha256 hash is stored.
export async function createPasswordResetToken(userId: number): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = createTokenExpiry(RESET_TOKEN_TTL_MINUTES);
  const pool = getDbPool();
  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt],
  );
  return rawToken;
}

// True if the user already has a reset token issued within the cooldown window.
// Used to throttle repeated forgot-password requests for the same account.
export async function hasRecentResetToken(
  userId: number,
  withinMinutes: number = RESET_COOLDOWN_MINUTES,
): Promise<boolean> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM password_reset_tokens WHERE user_id = ? AND created_at >= (NOW() - INTERVAL ? MINUTE) LIMIT 1",
    [userId, withinMinutes],
  );
  return rows.length > 0;
}

export async function findResetTokenByRaw(
  rawToken: string,
): Promise<{ id: number; userId: number; row: ResetTokenRow } | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<ResetTokenLookupRow[]>(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1",
    [hashToken(rawToken)],
  );
  const found = rows[0];
  if (!found) return null;
  return {
    id: found.id,
    userId: found.user_id,
    row: { expires_at: found.expires_at, used_at: found.used_at },
  };
}

// Atomically mark a token used (only if still unused) → returns true if this call consumed it.
export async function markResetTokenUsed(tokenId: number): Promise<boolean> {
  const pool = getDbPool();
  const [result] = (await pool.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
    [tokenId],
  )) as [{ affectedRows: number }, unknown];
  return result.affectedRows === 1;
}
