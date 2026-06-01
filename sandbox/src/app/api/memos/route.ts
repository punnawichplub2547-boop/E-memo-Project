import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { serializeMemoRecord, type MemoDbRow, type ReadActionDbRow } from "@/lib/db-memos";

export const dynamic = "force-dynamic";

type ReadActionRowWithMemo = ReadActionDbRow & {
  memo_id: number;
};

export async function GET() {
  try {
    const pool = getDbPool();
    const [memoRows] = await pool.query<QueryRows<MemoDbRow>>(
      "SELECT * FROM memos ORDER BY created_at DESC, id DESC"
    );
    const [readRows] = await pool.query<QueryRows<ReadActionRowWithMemo>>(
      `SELECT ra.memo_id, ra.recipient_name, ra.status, ra.acted_at, ra.skip_reason
       FROM read_actions ra
       JOIN memos m ON ra.memo_id = m.id AND ra.revision_no = m.revision_no
       ORDER BY ra.id ASC`
    );

    const readsByMemoId = new Map<number, ReadActionDbRow[]>();
    for (const row of readRows) {
      const rows = readsByMemoId.get(row.memo_id) ?? [];
      rows.push(row);
      readsByMemoId.set(row.memo_id, rows);
    }

    return NextResponse.json(
      memoRows.map((row) => serializeMemoRecord(row, readsByMemoId.get(row.id) ?? []))
    );
  } catch (error) {
    console.error("[GET /api/memos]", error);
    return NextResponse.json({ error: "Unable to load memos" }, { status: 500 });
  }
}

type QueryRows<T> = T[] & RowDataPacket[];
