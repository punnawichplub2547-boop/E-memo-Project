import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { deleteIssueReport } from "@/lib/issue-reports";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reportId = Number((await params).id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }
  try {
    const deleted = await deleteIssueReport(getDbPool(), reportId);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("[DELETE /api/admin/issues/[id]]", error);
    return NextResponse.json({ error: "Failed to delete issue report" }, { status: 500 });
  }
}
