import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "manager", "general-manager", "managing-director"] as const;

type DeptRow = {
  department_name: string;
  status: string;
  count: number;
  budget_total: number;
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.roles.some(r => (ALLOWED_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const month = req.nextUrl.searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month parameter required (YYYY-MM)" }, { status: 400 });
    }

    const pool = getDbPool();
    const [rows] = await pool.query<(DeptRow & import("mysql2").RowDataPacket)[]>(
      `SELECT
         department_name,
         status,
         COUNT(*) AS count,
         SUM(COALESCE(budget_used, budget_plan, 0)) AS budget_total
       FROM memos
       WHERE deleted_at IS NULL
         AND DATE_FORMAT(created_at, '%Y-%m') = ?
       GROUP BY department_name, status`,
      [month]
    );

    const statusTotals: Record<string, number> = {};
    const deptMap: Record<string, { submitted: number; approved: number; rejected: number; budgetTotal: number }> = {};

    for (const row of rows) {
      const { department_name, status, count, budget_total } = row;
      statusTotals[status] = (statusTotals[status] ?? 0) + Number(count);
      if (!deptMap[department_name]) {
        deptMap[department_name] = { submitted: 0, approved: 0, rejected: 0, budgetTotal: 0 };
      }
      const dept = deptMap[department_name];
      dept.submitted += Number(count);
      if (status === "approved") dept.approved += Number(count);
      if (status === "rejected") dept.rejected += Number(count);
      dept.budgetTotal += Number(budget_total);
    }

    const total = Object.values(statusTotals).reduce((a, b) => a + b, 0);
    const byDepartment = Object.entries(deptMap)
      .map(([department, data]) => ({ department, ...data }))
      .sort((a, b) => b.submitted - a.submitted);

    return NextResponse.json({
      month,
      total,
      byStatus: {
        pending: statusTotals["pending"] ?? 0,
        approved: statusTotals["approved"] ?? 0,
        rejected: statusTotals["rejected"] ?? 0,
        returned: statusTotals["returned"] ?? 0,
        draft: statusTotals["draft"] ?? 0,
      },
      byDepartment,
    });
  } catch (error) {
    console.error("[GET /api/report]", error);
    return NextResponse.json({ error: "Unable to load report" }, { status: 500 });
  }
}
