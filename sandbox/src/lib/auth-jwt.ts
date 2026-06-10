// Edge-runtime-safe JWT helpers only (jose, no Node.js-only deps).
// Imported by middleware and API routes. bcryptjs lives in auth.ts (Node.js only).
import { SignJWT, jwtVerify } from "jose";

export type SessionUser = {
  userId: number;
  employeeCardId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  roles: string[];
  approvalLevel: string | null;
};

export const COOKIE_NAME = "em-session";
const EXPIRES_IN = 8 * 60 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}
