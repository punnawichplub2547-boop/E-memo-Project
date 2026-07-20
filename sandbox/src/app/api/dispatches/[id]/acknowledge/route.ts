import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { acknowledgeDispatch } from "@/lib/db-dispatches";

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

    const { notes } = await req.json().catch(() => ({ notes: undefined }));
    const success = await acknowledgeDispatch(id, session.userId, notes);
    if (!success) {
      return NextResponse.json({ error: "Unable to acknowledge dispatch or not authorized" }, { status: 404 });
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/dispatches/[id]/acknowledge error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
