import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { createLinkToken } from "@/lib/telegram/linking";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) return NextResponse.json({ error: "Telegram not configured" }, { status: 500 });

  const rawToken = await createLinkToken(session.userId, getDbPool());
  return NextResponse.json({ deepLink: `https://t.me/${botUsername}?start=${rawToken}` });
}
