import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { returnMemoAction, WorkflowActionError } from "@/lib/workflow-actions";
import { notifyMemoEvent } from "@/lib/notify-memo-event";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { returnReason?: unknown };
    const returnReason = typeof body.returnReason === "string" ? body.returnReason : "";

    await returnMemoAction({ memoNo, actorUserId: session.userId, reason: returnReason, source: "web" });
    void notifyMemoEvent(memoNo, "returned").catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkflowActionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/memos/[id]/return]", error);
    return NextResponse.json({ error: "Unable to return memo" }, { status: 500 });
  }
}
