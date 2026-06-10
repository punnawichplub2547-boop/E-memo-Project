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
    const { id } = await params;
    await rejectUser(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/users/[id]/reject]", err);
    return NextResponse.json({ error: "Failed to reject user" }, { status: 500 });
  }
}
