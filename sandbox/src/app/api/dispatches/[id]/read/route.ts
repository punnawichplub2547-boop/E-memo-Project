import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { markDispatchAsRead } from "@/lib/db-dispatches";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await markDispatchAsRead(id, session.userId);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/dispatches/[id]/read error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
