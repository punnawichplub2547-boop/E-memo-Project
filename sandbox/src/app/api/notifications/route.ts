import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { listNotificationsForUser, parseNotificationLimit } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = parseNotificationLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const pool = getDbPool();
    const { notifications, unreadCount } = await listNotificationsForUser(
      pool,
      session.userId,
      limit,
    );
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}
