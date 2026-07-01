import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { reviewMemoAction, WorkflowActionError } from "@/lib/workflow-actions";
import type { ReviewResponse } from "@/lib/workflow-rules";
import { notifyMemoEvent } from "@/lib/notify-memo-event";

export const dynamic = "force-dynamic";

const VALID_RESPONSES: ReviewResponse[] = [
  "acknowledged_no_objection",
  "comment",
  "request_revision",
  "escalate_to_md_approval",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: memoNo } = await params;
  const body = (await request.json().catch(() => null)) as
    | { response?: string; comment?: string; reason?: string }
    | null;
  if (!body || !VALID_RESPONSES.includes(body.response as ReviewResponse)) {
    return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  }

  try {
    await reviewMemoAction({
      memoNo,
      actorUserId: session.userId,
      response: body.response as ReviewResponse,
      comment: body.comment,
      reason: body.reason,
      source: "web",
    });
    const eventType = body.response === "request_revision" ? "returned" : "advanced";
    void notifyMemoEvent(memoNo, eventType, session.userId).catch((err) =>
      console.error(`[notifyMemoEvent] md-review ${eventType} failed:`, err));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkflowActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/memos/[id]/md-review]", error);
    return NextResponse.json({ error: "Unable to record MD review" }, { status: 500 });
  }
}
