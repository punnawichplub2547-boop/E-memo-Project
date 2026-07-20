import { getDbPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface MemoTemplate {
  id: number;
  userId: number;
  name: string;
  templateJson: string; // Stored as JSON string
  createdAt: string;
  updatedAt: string;
}

export async function createTemplate(userId: number, name: string, templateJson: object): Promise<number> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO memo_templates (user_id, name, template_json) VALUES (?, ?, ?)",
    [userId, name, JSON.stringify(templateJson)]
  );
  return result.insertId;
}

export async function getTemplatesByUserId(userId: number): Promise<MemoTemplate[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, user_id as userId, name, template_json as templateJson, created_at as createdAt, updated_at as updatedAt FROM memo_templates WHERE user_id = ? ORDER BY id DESC",
    [userId]
  );
  return rows.map(r => ({
    id: Number(r.id),
    userId: Number(r.userId),
    name: r.name,
    templateJson: typeof r.templateJson === "string" ? r.templateJson : JSON.stringify(r.templateJson),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getTemplateById(id: number): Promise<MemoTemplate | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, user_id as userId, name, template_json as templateJson, created_at as createdAt, updated_at as updatedAt FROM memo_templates WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    userId: Number(r.userId),
    name: r.name,
    templateJson: typeof r.templateJson === "string" ? r.templateJson : JSON.stringify(r.templateJson),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function deleteTemplate(id: number, userId: number): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM memo_templates WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  return result.affectedRows > 0;
}

export async function updateTemplate(id: number, userId: number, name: string, templateJson: object): Promise<boolean> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE memo_templates SET name = ?, template_json = ? WHERE id = ? AND user_id = ?",
    [name, JSON.stringify(templateJson), id, userId]
  );
  return result.affectedRows > 0;
}

