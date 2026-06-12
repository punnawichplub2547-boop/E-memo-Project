import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { rejectMemoAction, WorkflowActionError } from "@/lib/workflow-actions";

export const dynamic = "force-dynamic";

// Hardened per docs/telegram-workflow-hardening-spec.md. Only `disposition`
// and `rejectReason` are read from the body.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      disposition?: unknown;
      rejectReason?: unknown;
    };
    const disposition =
      body.disposition === "close" || body.disposition === "revision-allowed"
        ? body.disposition
        : null;
    if (!disposition) {
      return NextResponse.json({ error: "disposition is required" }, { status: 400 });
    }
    const rejectReason = typeof body.rejectReason === "string" ? body.rejectReason : "";

    await rejectMemoAction({
      memoNo,
      actorUserId: session.userId,
      disposition,
      reason: rejectReason,
      source: "web",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkflowActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/memos/[id]/reject]", error);
    return NextResponse.json({ error: "Unable to reject memo" }, { status: 500 });
  }
}
