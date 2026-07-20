import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { getDispatchDetails } from "@/lib/db-dispatches";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

    const dispatch = await getDispatchDetails(id);
    if (!dispatch) {
      return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
    }

    // Access Control: Check if user is either the sender or a recipient
    const isSender = dispatch.senderUserId === session.userId;
    const isRecipient = dispatch.recipients.some(
      (r) => r.targetUserId === session.userId
    );

    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ dispatch });
  } catch (error) {
    console.error("GET /api/dispatches/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
