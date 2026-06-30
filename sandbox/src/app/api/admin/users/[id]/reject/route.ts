import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { rejectUser } from "@/lib/db-users";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session?.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const userId = Number((await params).id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    await rejectUser(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/users/[id]/reject]", err);
    return NextResponse.json({ error: "Failed to reject user" }, { status: 500 });
  }
}
