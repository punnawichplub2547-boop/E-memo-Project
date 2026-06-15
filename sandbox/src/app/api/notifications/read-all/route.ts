import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const pool = getDbPool();
    const count = await markAllNotificationsRead(pool, session.userId);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error("[POST /api/notifications/read-all]", error);
    return NextResponse.json({ error: "Unable to mark notifications read" }, { status: 500 });
  }
}
