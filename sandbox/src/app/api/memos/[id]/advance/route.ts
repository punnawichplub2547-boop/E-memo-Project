import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { approveMemoAction, WorkflowActionError } from "@/lib/workflow-actions";
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

    await approveMemoAction({ memoNo, actorUserId: session.userId, source: "web" });
    void notifyMemoEvent(memoNo, "advanced", session.userId).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkflowActionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/memos/[id]/advance]", error);
    return NextResponse.json({ error: "Unable to advance memo step" }, { status: 500 });
  }
}
