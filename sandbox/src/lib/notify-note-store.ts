import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { isSafeAttachmentSegment } from "./attachments";
import {
  hasNotifyNoteContent,
  normaliseNotifyNoteText,
  type NotifyNote,
  type NotifyNoteImage,
} from "./notify-note";

type NotifyNoteRow = RowDataPacket & {
  notify_note: string | null;
  notify_note_images_json: unknown;
  notify_attach_excel: number | null;
};

function parseImages(raw: unknown): NotifyNoteImage[] {
  if (raw == null) return [];
  // mysql2 คืนคอลัมน์ JSON เป็น object ที่แปลงแล้วบางครั้ง และเป็นสตริงบางครั้ง
  // (ขึ้นกับไดรเวอร์/การตั้งค่า) — รับทั้งสองแบบ ไม่งั้นจะพังเงียบบนเครื่องหนึ่งแต่ดีอีกเครื่อง
  const value = typeof raw === "string" ? safeParse(raw) : raw;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is NotifyNoteImage =>
    typeof item === "object" && item !== null &&
    typeof (item as NotifyNoteImage).storedName === "string" &&
    typeof (item as NotifyNoteImage).originalName === "string");
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** อ่าน short note ของเมโม คืน null เมื่อไม่มีอะไรจะส่ง — ตัวเรียกจึงข้ามได้ทันที */
export async function loadNotifyNote(pool: Pool, memoDbId: number): Promise<NotifyNote | null> {
  try {
    const [rows] = await pool.query<NotifyNoteRow[]>(
      "SELECT notify_note, notify_note_images_json, notify_attach_excel FROM memos WHERE id = ? LIMIT 1",
      [memoDbId],
    );
    const row = rows[0];
    if (!row) return null;
    const note: NotifyNote = {
      text: normaliseNotifyNoteText(row.notify_note),
      images: parseImages(row.notify_note_images_json),
      attachExcel: Boolean(row.notify_attach_excel),
    };
    return hasNotifyNoteContent(note) ? note : null;
  } catch (err) {
    // ฐานข้อมูลที่ยังไม่ได้รัน migration ต้องไม่ทำให้การแจ้งเตือนทั้งก้อนล้ม
    console.warn("[loadNotifyNote] unavailable:", err);
    return null;
  }
}

/** โหลดไฟล์รูปจากดิสก์ ข้ามตัวที่อ่านไม่ได้ (การแจ้งเตือนสำคัญกว่ารูป) */
export async function readNotifyNoteImageBuffers(
  memoNo: string,
  images: NotifyNoteImage[],
): Promise<{ image: NotifyNoteImage; content: Buffer }[]> {
  const results: { image: NotifyNoteImage; content: Buffer }[] = [];
  for (const image of images) {
    if (!isSafeAttachmentSegment(memoNo) || !isSafeAttachmentSegment(image.storedName)) continue;
    try {
      const file = path.join(process.cwd(), "storage", "notify-notes", memoNo, image.storedName);
      results.push({ image, content: await readFile(file) });
    } catch (err) {
      console.warn(`[readNotifyNoteImageBuffers] skipped ${image.storedName}:`, err);
    }
  }
  return results;
}
