import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { isMemoVisibleTo } from "@/lib/memo-visibility";
import { memoToExcelBuffer } from "@/lib/export/memo-excel";
import { loadMemoForExport } from "@/lib/export/load-memo-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const loaded = await loadMemoForExport(memoNo, getDbPool());
    if (!loaded) return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    const { memo, signatures } = loaded;

    if (!session.roles.includes("admin") && !isMemoVisibleTo(memo, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await memoToExcelBuffer(memo, signatures);
    const safeName = memoNo.replace(/[^A-Za-z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="memo-${safeName}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/memos/[id]/export-excel]", error);
    return NextResponse.json({ error: "Unable to export memo" }, { status: 500 });
  }
}
