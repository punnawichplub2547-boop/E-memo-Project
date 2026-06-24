import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { listIssueReports, parseIssueStatusFilter } from "@/lib/issue-reports";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function intParam(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const sp = req.nextUrl.searchParams;
    const status = parseIssueStatusFilter(sp.get("status"));
    const limit = Math.min(intParam(sp.get("limit"), PAGE_SIZE), 100);
    const offset = intParam(sp.get("offset"), 0);

    const pool = getDbPool();
    const { reports, total } = await listIssueReports(pool, { status, limit, offset });
    return NextResponse.json({ rows: reports, total });
  } catch (error) {
    console.error("[GET /api/admin/issues]", error);
    return NextResponse.json({ error: "Failed to load issue reports" }, { status: 500 });
  }
}
