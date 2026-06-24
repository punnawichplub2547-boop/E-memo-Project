import { NextRequest, NextResponse } from "next/server";
import type { Pool } from "mysql2/promise";
import { getDbPool } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { buildIssueReportNotification, createNotification } from "@/lib/notifications";
import { createIssueReport } from "@/lib/issue-reports";

export const dynamic = "force-dynamic";

const MAX_DESCRIPTION_LENGTH = 2000;

async function listActiveAdminIds(pool: Pool): Promise<number[]> {
  // roles_json is a VARCHAR holding a JSON string e.g. ["admin"]; LIKE is more
  // robust here than JSON_CONTAINS against a non-JSON-typed column.
  const [rows] = (await pool.query(
    `SELECT id FROM users WHERE roles_json LIKE '%"admin"%' AND status = 'active'`,
  )) as [Array<{ id: number }>, unknown];
  return rows.map(r => Number(r.id));
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(sessionToken);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "กรุณากรอกรายละเอียดปัญหา" }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `รายละเอียดยาวเกินไป (สูงสุด ${MAX_DESCRIPTION_LENGTH} ตัวอักษร)` },
      { status: 400 },
    );
  }

  try {
    const pool = getDbPool();
    const reporterName = `${session.firstName} ${session.lastName}`.trim();

    // Persist the durable log row FIRST so the report is never lost even if the
    // notification fan-out below fails.
    await createIssueReport(pool, {
      reporterUserId: session.userId,
      reporterName,
      reporterDepartment: session.department,
      reporterEmail: session.email,
      description,
    });

    const adminIds = await listActiveAdminIds(pool);

    const { title, body: notificationBody } = buildIssueReportNotification({
      reporterName,
      department: session.department,
      email: session.email,
      description,
    });

    await Promise.all(
      adminIds.map(adminId =>
        createNotification(pool, {
          memoId: null,
          recipientUserId: adminId,
          type: "user_issue_report",
          title,
          body: notificationBody,
        }),
      ),
    );

    return NextResponse.json({ ok: true, notified: adminIds.length });
  } catch (error) {
    console.error("[POST /api/profile/report-issue]", error);
    return NextResponse.json({ error: "ส่งแจ้งปัญหาไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
