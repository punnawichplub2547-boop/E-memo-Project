import type { EmailAttachment } from "./client";
import type { NotifyNote, NotifyNoteImage } from "../notify-note";

const NOTE_HEADING = "เรื่องเพิ่มเติม";
const BRAND_NAVY = "#1F3864";
const BORDER = "#d8dee9";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Content-ID ของรูปแต่ละใบ ต้องตรงกันระหว่าง <img> กับ attachment ที่แนบไป */
export function notifyNoteCid(image: NotifyNoteImage): string {
  return `note-${image.id}`;
}

export function buildNotifyNoteText(note: NotifyNote): string {
  if (note.text.length === 0 && note.images.length === 0) return "";
  const lines = [`${NOTE_HEADING}:`];
  if (note.text.length > 0) lines.push(note.text);
  if (note.images.length > 0) lines.push(`(แนบรูป ${note.images.length} รูป)`);
  return lines.join("\n");
}

export function buildNotifyNoteHtml(note: NotifyNote, images: NotifyNoteImage[]): string {
  if (note.text.length === 0 && images.length === 0) return "";
  const body = note.text.length > 0
    ? `<div style="white-space:pre-wrap;">${escapeHtml(note.text).replace(/\n/g, "<br>")}</div>`
    : "";
  // รูปฝังด้วย cid: เท่านั้น — Outlook บล็อกรูปจาก URL ภายนอกโดยดีฟอลต์
  const pictures = images
    .map((image) =>
      `<img src="cid:${notifyNoteCid(image)}" alt="${escapeHtml(image.originalName)}" ` +
      `style="display:block;max-width:100%;margin-top:12px;border:1px solid ${BORDER};border-radius:6px;" />`)
    .join("");
  return (
    `<div style="margin-top:16px;padding:12px 14px;border-left:3px solid ${BRAND_NAVY};background:#f8fafc;">` +
    `<div style="font-weight:700;color:${BRAND_NAVY};margin-bottom:6px;">${NOTE_HEADING}</div>` +
    `${body}${pictures}` +
    `</div>`
  );
}

export function buildNotifyNoteEmailAttachments(
  loaded: { image: NotifyNoteImage; content: Buffer }[],
): EmailAttachment[] {
  return loaded.map(({ image, content }) => ({
    filename: image.originalName,
    content,
    cid: notifyNoteCid(image),
  }));
}
