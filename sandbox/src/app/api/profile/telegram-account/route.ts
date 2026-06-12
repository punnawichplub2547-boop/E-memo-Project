import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { getActiveTelegramAccount, revokeTelegramAccount } from "@/lib/telegram/linking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getActiveTelegramAccount(session.userId, getDbPool());
  if (!account) return NextResponse.json({ linked: false });
  return NextResponse.json({ linked: true, username: account.username, linkedAt: account.linkedAt });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await revokeTelegramAccount(session.userId, getDbPool());
  return NextResponse.json({ ok: true });
}
