import { rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { sanitizeAttachmentFileName } from "@/lib/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoIdRow = RowDataPacket & { id: number };

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memoNo } = await params;
  let connection: PoolConnection | null = null;
  try {
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<MemoIdRow[]>(
      "SELECT id FROM memos WHERE memo_no = ? FOR UPDATE",
      [memoNo]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const memoDbId = rows[0].id;
    await connection.execute("DELETE FROM read_actions WHERE memo_id = ?", [memoDbId]);
    await connection.execute("DELETE FROM workflow_step_actions WHERE memo_id = ?", [memoDbId]);
    await connection.execute("DELETE FROM memo_revisions WHERE memo_id = ?", [memoDbId]);
    await connection.execute("DELETE FROM memos WHERE id = ?", [memoDbId]);

    await connection.commit();
    await removeAttachmentDirectory(memoNo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[DELETE /api/memos/[id]/destroy]", error);
    return NextResponse.json({ error: "Unable to permanently delete memo" }, { status: 500 });
  } finally {
    connection?.release();
  }
}

async function removeAttachmentDirectory(memoNo: string) {
  const storageRoot = path.resolve(process.cwd(), "storage", "attachments");
  const memoDir = path.resolve(storageRoot, sanitizeAttachmentFileName(memoNo));
  const relative = path.relative(storageRoot, memoDir);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return;
  try {
    await rm(memoDir, { recursive: true, force: true });
  } catch (error) {
    console.error("[DELETE /api/memos/[id]/destroy] attachment cleanup failed", error);
  }
}
