import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { approveMemoAction, WorkflowActionError } from "@/lib/workflow-actions";

export const dynamic = "force-dynamic";

// Hardened per docs/telegram-workflow-hardening-spec.md: the server decides
// actor, permission, and next workflow state. Any legacy body fields the old
// client still sends (actorName, nextCurrentStep, ...) are ignored entirely.
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

    // Drain the legacy request body; its fields are untrusted and unused.
    await request.json().catch(() => undefined);

    await approveMemoAction({ memoNo, actorUserId: session.userId, source: "web" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkflowActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/memos/[id]/advance]", error);
    return NextResponse.json({ error: "Unable to advance memo step" }, { status: 500 });
  }
}
