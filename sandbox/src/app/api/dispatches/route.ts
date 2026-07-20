import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { createDispatch, getSentDispatches, getReceivedDispatches } from "@/lib/db-dispatches";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subject, content, memoId, attachments, recipients } = await req.json();
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }

    // Verify all recipients have required fields
    for (const r of recipients) {
      if (!r.type || !["user", "department"].includes(r.type) || !r.targetId) {
        return NextResponse.json({ error: "Invalid recipient entry" }, { status: 400 });
      }
    }

    const id = await createDispatch(session.userId, {
      subject,
      content,
      memoId: memoId ? Number(memoId) : null,
      attachments,
      recipients,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("POST /api/dispatches error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "inbox";

    if (mode === "sent") {
      const dispatches = await getSentDispatches(session.userId);
      return NextResponse.json({ dispatches });
    } else {
      const dispatches = await getReceivedDispatches(session.userId);
      return NextResponse.json({ dispatches });
    }
  } catch (error) {
    console.error("GET /api/dispatches error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
