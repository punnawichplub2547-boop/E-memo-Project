// Node.js-only auth helpers (bcryptjs). Do NOT import from middleware.
// For JWT/session, use auth-jwt.ts which is edge-runtime-safe.
import bcrypt from "bcryptjs";
import { verifyToken, type SessionUser } from "./auth-jwt";
import { findUserById, parseRoles } from "./db-users";

export { signToken, verifyToken, COOKIE_NAME, type SessionUser } from "./auth-jwt";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getActiveSessionUserFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const tokenUser = await verifyToken(token);
  if (!tokenUser) return null;

  const dbUser = await findUserById(tokenUser.userId);
  if (!dbUser || dbUser.status !== "active") return null;

  return {
    userId: dbUser.id,
    employeeCardId: dbUser.employee_card_id,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    department: dbUser.department,
    roles: parseRoles(dbUser.roles_json),
    approvalLevel: dbUser.approval_level,
  };
}
