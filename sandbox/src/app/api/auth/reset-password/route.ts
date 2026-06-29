import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { updateUserPassword } from "@/lib/db-users";
import { findResetTokenByRaw, markResetTokenUsed, isResetTokenUsable } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const INVALID = "Reset link is invalid or has expired. Please request a new one.";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const found = await findResetTokenByRaw(token);
    if (!isResetTokenUsable(found?.row)) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    // Atomic single-use consume: if a concurrent submit already consumed it, stop.
    const consumed = await markResetTokenUsed(found!.id);
    if (!consumed) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await updateUserPassword(found!.userId, passwordHash);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json({ error: "Unable to reset the password" }, { status: 500 });
  }
}
