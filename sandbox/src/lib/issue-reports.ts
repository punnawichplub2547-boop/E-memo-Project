import type { Pool } from "mysql2/promise";
import { nowMysqlUtcDateTime } from "./workflow-rules";

export type IssueStatus = "open" | "resolved";

export type IssueReport = {
  id: number;
  reporterUserId: number | null;
  reporterName: string;
  reporterDepartment: string;
  reporterEmail: string;
  description: string;
  status: IssueStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: number | null;
};

type RawIssueReportRow = {
  id: number;
  reporter_user_id: number | null;
  reporter_name: string;
  reporter_department: string;
  reporter_email: string;
  description: string;
  status: IssueStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: number | null;
};

export function mapIssueReportRow(row: RawIssueReportRow): IssueReport {
  return {
    id: Number(row.id),
    reporterUserId: row.reporter_user_id === null ? null : Number(row.reporter_user_id),
    reporterName: row.reporter_name,
    reporterDepartment: row.reporter_department,
    reporterEmail: row.reporter_email,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id === null ? null : Number(row.resolved_by_user_id),
  };
}

// Normalises an arbitrary ?status query value to a valid filter, or undefined
// (= no status filter / show all).
export function parseIssueStatusFilter(raw: string | null): IssueStatus | undefined {
  return raw === "open" || raw === "resolved" ? raw : undefined;
}

export async function createIssueReport(
  pool: Pool,
  input: {
    reporterUserId: number | null;
    reporterName: string;
    reporterDepartment: string;
    reporterEmail: string;
    description: string;
  },
): Promise<number> {
  const now = nowMysqlUtcDateTime();
  const [result] = (await pool.query(
    `INSERT INTO issue_reports
       (reporter_user_id, reporter_name, reporter_department, reporter_email, description, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    [
      input.reporterUserId,
      input.reporterName,
      input.reporterDepartment,
      input.reporterEmail,
      input.description,
      now,
    ],
  )) as [{ insertId: number }, unknown];
  return result.insertId;
}

// Lists reports newest-first with an optional status filter and pagination.
// Returns the page plus the total matching count (for paging UI).
export async function listIssueReports(
  pool: Pool,
  options: { status?: IssueStatus; limit?: number; offset?: number } = {},
): Promise<{ reports: IssueReport[]; total: number }> {
  const limit = Math.min(Math.max(1, Math.trunc(options.limit ?? 50)), 100);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const where = options.status ? "WHERE status = ?" : "";
  const filterParams = options.status ? [options.status] : [];

  const [rows] = (await pool.query(
    `SELECT id, reporter_user_id, reporter_name, reporter_department, reporter_email,
            description, status, created_at, resolved_at, resolved_by_user_id
     FROM issue_reports
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...filterParams, limit, offset],
  )) as [RawIssueReportRow[], unknown];

  const [countRows] = (await pool.query(
    `SELECT COUNT(*) AS total FROM issue_reports ${where}`,
    filterParams,
  )) as [Array<{ total: number }>, unknown];

  return {
    reports: rows.map(mapIssueReportRow),
    total: Number(countRows[0]?.total ?? 0),
  };
}

// Sets a report's status. Resolving stamps resolved_at + resolver; reopening
// clears them. Returns true only when a row actually changed.
export async function setIssueReportStatus(
  pool: Pool,
  id: number,
  status: IssueStatus,
  byUserId: number,
): Promise<boolean> {
  const resolvedAt = status === "resolved" ? nowMysqlUtcDateTime() : null;
  const resolvedBy = status === "resolved" ? byUserId : null;
  const [result] = (await pool.query(
    `UPDATE issue_reports
     SET status = ?, resolved_at = ?, resolved_by_user_id = ?
     WHERE id = ? AND status <> ?`,
    [status, resolvedAt, resolvedBy, id, status],
  )) as [{ affectedRows: number }, unknown];
  return result.affectedRows > 0;
}
