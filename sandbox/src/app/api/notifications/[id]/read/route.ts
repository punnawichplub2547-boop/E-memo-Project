import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    const updated = await markNotificationRead(pool, session.userId, notificationId);
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[POST /api/notifications/[id]/read]", error);
    return NextResponse.json({ error: "Unable to mark notification read" }, { status: 500 });
  }
}
