import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { setIssueReportStatus } from "@/lib/issue-reports";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body.status !== "open" && body.status !== "resolved") {
    return NextResponse.json({ error: "status must be 'open' or 'resolved'" }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    const changed = await setIssueReportStatus(pool, reportId, body.status, session.userId);
    return NextResponse.json({ ok: true, changed });
  } catch (error) {
    console.error("[POST /api/admin/issues/[id]/status]", error);
    return NextResponse.json({ error: "Failed to update issue status" }, { status: 500 });
  }
}
