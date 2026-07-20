import { getDbPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface Dispatch {
  id: number;
  dispatchNo: string;
  subject: string;
  content: string;
  senderUserId: number;
  senderName?: string;
  senderDept?: string;
  memoId: number | null;
  status: string;
  attachmentsJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchRecipient {
  id: number;
  dispatchId: number;
  recipientType: "user" | "department";
  targetUserId: number;
  targetDept: string | null;
  status: "pending" | "read" | "acknowledged";
  readAt: string | null;
  acknowledgedAt: string | null;
  feedbackNotes: string | null;
}

export interface DispatchListItem {
  id: number;
  dispatchNo: string;
  subject: string;
  content: string;
  senderUserId: number;
  senderName: string;
  senderDept: string;
  memoId: number | null;
  dispatchStatus: string;
  readStatus: DispatchRecipient["status"];
  readAt: string | null;
  acknowledgedAt: string | null;
  feedbackNotes: string | null;
  createdAt: string;
}

export interface DispatchRecipientDetail {
  id: number;
  recipientType: "user" | "department";
  targetUserId: number;
  recipientName: string;
  recipientDept: string;
  targetDept: string | null;
  status: DispatchRecipient["status"];
  readAt: string | null;
  acknowledgedAt: string | null;
  feedbackNotes: string | null;
}

export interface DispatchDetails extends Dispatch {
  recipients: DispatchRecipientDetail[];
}

export async function generateDispatchNo(): Promise<string> {
  const pool = getDbPool();
  const year = new Date().getFullYear();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM dispatches WHERE dispatch_no LIKE ?",
    [`DP-${year}-%`]
  );
  const nextSeq = String(rows[0].count + 1).padStart(4, "0");
  return `DP-${year}-${nextSeq}`;
}

export async function createDispatch(
  senderUserId: number,
  params: {
    subject: string;
    content: string;
    memoId?: number | null;
    attachments?: Array<Record<string, unknown>>;
    recipients: Array<{ type: "user" | "department"; targetId: number | string }>;
  }
): Promise<number> {
  const pool = getDbPool();
  const dispatchNo = await generateDispatchNo();
  
  // 1. Insert into dispatches
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO dispatches (dispatch_no, subject, content, sender_user_id, memo_id, attachments_json) VALUES (?, ?, ?, ?, ?, ?)",
    [
      dispatchNo,
      params.subject.trim(),
      params.content.trim(),
      senderUserId,
      params.memoId || null,
      params.attachments ? JSON.stringify(params.attachments) : null
    ]
  );
  const dispatchId = result.insertId;

  // 2. Resolve recipients and insert into dispatch_recipients
  const userIdsToInsert = new Map<number, string | null>(); // target_user_id -> target_dept

  for (const recipient of params.recipients) {
    if (recipient.type === "user") {
      const uId = Number(recipient.targetId);
      if (uId > 0) {
        userIdsToInsert.set(uId, null);
      }
    } else if (recipient.type === "department") {
      const dept = String(recipient.targetId).trim();
      if (dept) {
        const [users] = await pool.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE department = ? AND status = 'active'",
          [dept]
        );
        for (const u of users) {
          userIdsToInsert.set(Number(u.id), dept);
        }
      }
    }
  }

  // Insert recipient rows
  for (const [uId, dept] of userIdsToInsert.entries()) {
    await pool.query(
      "INSERT INTO dispatch_recipients (dispatch_id, recipient_type, target_user_id, target_dept, status) VALUES (?, ?, ?, ?, 'pending') ON DUPLICATE KEY UPDATE status = status",
      [
        dispatchId,
        dept ? "department" : "user",
        uId,
        dept,
      ]
    );
  }

  return dispatchId;
}

export async function getSentDispatches(senderUserId: number): Promise<Dispatch[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, dispatch_no as dispatchNo, subject, content, sender_user_id as senderUserId, memo_id as memoId, status, attachments_json as attachmentsJson, created_at as createdAt, updated_at as updatedAt FROM dispatches WHERE sender_user_id = ? ORDER BY id DESC",
    [senderUserId]
  );
  return rows as Dispatch[];
}

export async function getReceivedDispatches(userId: number): Promise<DispatchListItem[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.dispatch_no as dispatchNo, d.subject, d.content, d.sender_user_id as senderUserId, 
            CONCAT(u.first_name, ' ', u.last_name) as senderName, u.department as senderDept,
            d.memo_id as memoId, d.status as dispatchStatus, dr.status as readStatus, 
            dr.read_at as readAt, dr.acknowledged_at as acknowledgedAt, dr.feedback_notes as feedbackNotes,
            d.created_at as createdAt
     FROM dispatches d
     JOIN dispatch_recipients dr ON d.id = dr.dispatch_id
     JOIN users u ON d.sender_user_id = u.id
     WHERE dr.target_user_id = ? AND d.status = 'active'
     ORDER BY d.id DESC`,
    [userId]
  );
  return rows as DispatchListItem[];
}

export async function getDispatchDetails(dispatchId: number): Promise<DispatchDetails | null> {
  const pool = getDbPool();
  
  const [dispatchRows] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.dispatch_no as dispatchNo, d.subject, d.content, d.sender_user_id as senderUserId, 
            CONCAT(u.first_name, ' ', u.last_name) as senderName, u.department as senderDept,
            d.memo_id as memoId, d.status, d.attachments_json as attachmentsJson, d.created_at as createdAt 
     FROM dispatches d
     JOIN users u ON d.sender_user_id = u.id
     WHERE d.id = ?`,
    [dispatchId]
  );
  if (dispatchRows.length === 0) return null;
  const dispatch = dispatchRows[0] as unknown as Dispatch;

  const [recipientRows] = await pool.query<RowDataPacket[]>(
    `SELECT dr.id, dr.recipient_type as recipientType, dr.target_user_id as targetUserId, 
            CONCAT(u.first_name, ' ', u.last_name) as recipientName, u.department as recipientDept,
            dr.target_dept as targetDept, dr.status, dr.read_at as readAt, 
            dr.acknowledged_at as acknowledgedAt, dr.feedback_notes as feedbackNotes
     FROM dispatch_recipients dr
     JOIN users u ON dr.target_user_id = u.id
     WHERE dr.dispatch_id = ?`,
    [dispatchId]
  );

  return {
    ...dispatch,
    recipients: recipientRows as unknown as DispatchRecipientDetail[],
  };
}

export async function markDispatchAsRead(dispatchId: number, userId: number): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE dispatch_recipients SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE dispatch_id = ? AND target_user_id = ? AND status = 'pending'",
    [dispatchId, userId]
  );
  return result.affectedRows > 0;
}

export async function acknowledgeDispatch(dispatchId: number, userId: number, notes?: string): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE dispatch_recipients SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP, feedback_notes = ? WHERE dispatch_id = ? AND target_user_id = ? AND status IN ('pending', 'read')",
    [notes || null, dispatchId, userId]
  );
  return result.affectedRows > 0;
}
