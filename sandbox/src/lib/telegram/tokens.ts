import { createHash, randomBytes } from "node:crypto";

export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createTokenExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isTokenExpired(expiresAt: Date | string): boolean {
  const d =
    expiresAt instanceof Date
      ? expiresAt
      : new Date(String(expiresAt).replace(" ", "T") + "Z");
  return d.getTime() <= Date.now();
}
