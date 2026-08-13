// V2 §3 — "short note": ข้อความ (+รูป) ที่ส่งไปกับการแจ้งเตือนตอนส่งเมโมครั้งแรกเท่านั้น
// จงใจแยกจาก MemoAttachment: ไฟล์แนบเป็นส่วนหนึ่งของเอกสาร แต่ note ไม่ใช่ — มันไม่ขึ้น
// ในตัวเมโมและไม่ขึ้นในฟอร์ม F-DC-006 (Q14) จึงต้องมี allowlist และที่เก็บของตัวเอง
export const MAX_NOTIFY_NOTE_IMAGES = 3;
export const MAX_NOTIFY_NOTE_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_NOTIFY_NOTE_CHARS = 1000;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

export type NotifyNoteImage = {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
};

export type NotifyNote = {
  text: string;
  images: NotifyNoteImage[];
  attachExcel: boolean;
};

export function normaliseNotifyNoteText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // CRLF ถูกทำให้เป็น LF ก่อนตัดความยาว เพื่อให้จำนวนอักขระที่ผู้ใช้เห็นในกล่อง
  // ตรงกับที่เก็บจริง และข้อความออกมาเหมือนกันทั้งอีเมลและ Telegram
  return raw.replace(/\r\n/g, "\n").trim().slice(0, MAX_NOTIFY_NOTE_CHARS);
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export function isAllowedNotifyNoteImage(name: string, mimeType: string): boolean {
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extensionOf(name))) return false;
  // mimeType ว่างเกิดได้จากเบราว์เซอร์บางตัว — ยอมรับได้เพราะนามสกุลผ่านแล้ว
  return mimeType === "" || ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

export function validateNotifyNoteImageFiles(
  files: { name: string; type: string; size: number }[],
): { ok: true } | { ok: false; message: string } {
  if (files.length > MAX_NOTIFY_NOTE_IMAGES) {
    return { ok: false, message: `แนบรูปได้ไม่เกิน ${MAX_NOTIFY_NOTE_IMAGES} รูป` };
  }
  for (const file of files) {
    if (!isAllowedNotifyNoteImage(file.name, file.type)) {
      return { ok: false, message: `${file.name} ไม่ใช่รูปภาพ PNG หรือ JPG` };
    }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_NOTIFY_NOTE_TOTAL_BYTES) {
    return { ok: false, message: "รูปทั้งหมดรวมกันต้องไม่เกิน 10 MB" };
  }
  return { ok: true };
}

export function hasNotifyNoteContent(note: NotifyNote | null | undefined): boolean {
  if (!note) return false;
  return note.text.length > 0 || note.images.length > 0 || note.attachExcel;
}
