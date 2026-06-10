import { getDbPool } from "./db";
import type { RowDataPacket } from "mysql2";

export type UserRow = {
  id: number;
  employee_card_id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  department: string;
  roles_json: string; // VARCHAR(500) JSON array e.g. '["admin","requester"]'
  approval_level: string | null;
  status: "pending" | "active" | "suspended";
  created_at: string;
  updated_at: string;
};

export type PublicUser = Omit<UserRow, "password_hash">;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return (rows[0] as UserRow) ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return (rows[0] as UserRow) ?? null;
}

export async function findUserByEmployeeCardId(cardId: string): Promise<UserRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE employee_card_id = ? LIMIT 1",
    [cardId]
  );
  return (rows[0] as UserRow) ?? null;
}

export async function createUser(data: {
  employeeCardId: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  department: string;
}): Promise<number> {
  const pool = getDbPool();
  const [result] = await pool.query(
    `INSERT INTO users (employee_card_id, email, first_name, last_name, password_hash, department, roles_json, status)
     VALUES (?, ?, ?, ?, ?, ?, '["requester"]', 'pending')`,
    [data.employeeCardId, data.email, data.firstName, data.lastName, data.passwordHash, data.department]
  ) as [{ insertId: number }, unknown];
  return result.insertId;
}

export async function listUsers(): Promise<PublicUser[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, employee_card_id, email, first_name, last_name, department, roles_json, approval_level, status, created_at, updated_at FROM users ORDER BY created_at DESC"
  );
  return rows as PublicUser[];
}

export async function approveUser(
  id: number,
  roles: string[],
  approvalLevel: string | null
): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    "UPDATE users SET status = 'active', roles_json = ?, approval_level = ?, updated_at = NOW() WHERE id = ?",
    [JSON.stringify(roles), approvalLevel || null, id]
  );
}

export async function rejectUser(id: number): Promise<void> {
  const pool = getDbPool();
  await pool.query("DELETE FROM users WHERE id = ? AND status = 'pending'", [id]);
}

export async function updateUserRoles(
  id: number,
  roles: string[],
  approvalLevel: string | null
): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    "UPDATE users SET roles_json = ?, approval_level = ?, updated_at = NOW() WHERE id = ?",
    [JSON.stringify(roles), approvalLevel || null, id]
  );
}

export async function updateUserStatus(
  id: number,
  status: "active" | "suspended"
): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    "UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?",
    [status, id]
  );
}

export function parseRoles(rolesJson: string): string[] {
  try { return JSON.parse(rolesJson) as string[]; } catch { return ["requester"]; }
}
