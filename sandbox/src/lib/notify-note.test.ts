import { describe, it, expect } from "vitest";
import {
  MAX_NOTIFY_NOTE_IMAGES,
  MAX_NOTIFY_NOTE_CHARS,
  normaliseNotifyNoteText,
  isAllowedNotifyNoteImage,
  validateNotifyNoteImageFiles,
  hasNotifyNoteContent,
} from "./notify-note";

describe("normaliseNotifyNoteText", () => {
  it("trims and keeps Thai text intact", () => {
    expect(normaliseNotifyNoteText("  ด่วนมาก ขอภายในวันนี้  ")).toBe("ด่วนมาก ขอภายในวันนี้");
  });

  it("returns empty string for non-string input", () => {
    expect(normaliseNotifyNoteText(undefined)).toBe("");
    expect(normaliseNotifyNoteText(null)).toBe("");
    expect(normaliseNotifyNoteText(42)).toBe("");
  });

  it("truncates beyond the character cap", () => {
    const long = "ก".repeat(MAX_NOTIFY_NOTE_CHARS + 50);
    expect(normaliseNotifyNoteText(long)).toHaveLength(MAX_NOTIFY_NOTE_CHARS);
  });

  it("normalises CRLF to LF so the text renders the same in every channel", () => {
    expect(normaliseNotifyNoteText("บรรทัด1\r\nบรรทัด2")).toBe("บรรทัด1\nบรรทัด2");
  });
});

describe("isAllowedNotifyNoteImage", () => {
  it("accepts png and jpeg", () => {
    expect(isAllowedNotifyNoteImage("shot.png", "image/png")).toBe(true);
    expect(isAllowedNotifyNoteImage("shot.jpg", "image/jpeg")).toBe(true);
    expect(isAllowedNotifyNoteImage("shot.jpeg", "image/jpeg")).toBe(true);
  });

  it("rejects a pdf even though the attachment allowlist permits it elsewhere", () => {
    expect(isAllowedNotifyNoteImage("quote.pdf", "application/pdf")).toBe(false);
  });

  it("rejects a mismatched extension and mime type", () => {
    expect(isAllowedNotifyNoteImage("shot.png", "application/pdf")).toBe(false);
  });
});

describe("validateNotifyNoteImageFiles", () => {
  const img = (size: number, name = "a.png") => ({ name, type: "image/png", size });

  it("accepts up to three images under the total cap", () => {
    expect(validateNotifyNoteImageFiles([img(100), img(100), img(100)])).toEqual({ ok: true });
  });

  it("rejects a fourth image", () => {
    const result = validateNotifyNoteImageFiles([img(1), img(1), img(1), img(1)]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain(String(MAX_NOTIFY_NOTE_IMAGES));
  });

  it("rejects when the combined size exceeds 10 MB even though each file is under it", () => {
    const sixMb = 6 * 1024 * 1024;
    const result = validateNotifyNoteImageFiles([img(sixMb), img(sixMb)]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("10 MB");
  });

  it("rejects a disallowed type", () => {
    const result = validateNotifyNoteImageFiles([{ name: "q.pdf", type: "application/pdf", size: 10 }]);
    expect(result.ok).toBe(false);
  });

  it("accepts an empty list", () => {
    expect(validateNotifyNoteImageFiles([])).toEqual({ ok: true });
  });
});

describe("hasNotifyNoteContent", () => {
  const image = { id: "1", originalName: "a.png", storedName: "x-a.png", size: 1, mimeType: "image/png" };

  it("is false for null and for an all-empty note", () => {
    expect(hasNotifyNoteContent(null)).toBe(false);
    expect(hasNotifyNoteContent({ text: "", images: [], attachExcel: false })).toBe(false);
  });

  it("is true when there is text, an image, or an Excel request on its own", () => {
    expect(hasNotifyNoteContent({ text: "ด่วน", images: [], attachExcel: false })).toBe(true);
    expect(hasNotifyNoteContent({ text: "", images: [image], attachExcel: false })).toBe(true);
    expect(hasNotifyNoteContent({ text: "", images: [], attachExcel: true })).toBe(true);
  });
});
