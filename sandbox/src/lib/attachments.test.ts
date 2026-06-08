import { describe, expect, it } from "vitest";
import {
  formatAttachmentSize,
  getAttachmentExtension,
  inferAttachmentContentType,
  isAllowedAttachmentFile,
  isSafeAttachmentSegment,
  sanitizeAttachmentFileName,
} from "./attachments";

describe("attachment helpers", () => {
  it("sanitizes filenames and strips path traversal", () => {
    expect(sanitizeAttachmentFileName("../quotes/ACME ราคา.pdf")).toBe("ACME-ราคา.pdf");
    expect(sanitizeAttachmentFileName("  weird   name (final).xlsx  ")).toBe("weird-name-final.xlsx");
  });

  it("falls back to attachment when sanitized filename is empty", () => {
    expect(sanitizeAttachmentFileName("////")).toBe("attachment");
  });

  it("returns lowercase extension without the leading dot", () => {
    expect(getAttachmentExtension("Quote.FINAL.PDF")).toBe("pdf");
    expect(getAttachmentExtension("no-extension")).toBe("");
  });

  it("allows supported business document and image types", () => {
    expect(isAllowedAttachmentFile("quote.pdf", "application/pdf")).toBe(true);
    expect(isAllowedAttachmentFile("sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isAllowedAttachmentFile("photo.jpg", "image/jpeg")).toBe(true);
  });

  it("rejects unsupported extensions even when a mime type is present", () => {
    expect(isAllowedAttachmentFile("script.exe", "application/octet-stream")).toBe(false);
    expect(isAllowedAttachmentFile("archive.zip", "application/zip")).toBe(false);
  });

  it("formats attachment size for display", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("infers content type from the file extension", () => {
    expect(inferAttachmentContentType("quote.pdf")).toBe("application/pdf");
    expect(inferAttachmentContentType("sheet.XLSX")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(inferAttachmentContentType("photo.jpeg")).toBe("image/jpeg");
    expect(inferAttachmentContentType("photo.jpg")).toBe("image/jpeg");
  });

  it("falls back to octet-stream for unknown or missing extensions", () => {
    expect(inferAttachmentContentType("archive.zip")).toBe("application/octet-stream");
    expect(inferAttachmentContentType("no-extension")).toBe("application/octet-stream");
  });

  it("accepts safe single-segment path values", () => {
    expect(isSafeAttachmentSegment("EM-20260608-093736-123")).toBe(true);
    expect(isSafeAttachmentSegment("a1b2-quote.pdf")).toBe(true);
  });

  it("rejects path-traversal and separator-bearing segments", () => {
    expect(isSafeAttachmentSegment("")).toBe(false);
    expect(isSafeAttachmentSegment(".")).toBe(false);
    expect(isSafeAttachmentSegment("..")).toBe(false);
    expect(isSafeAttachmentSegment("../secret")).toBe(false);
    expect(isSafeAttachmentSegment("nested/file.pdf")).toBe(false);
    expect(isSafeAttachmentSegment("nested\\file.pdf")).toBe(false);
    expect(isSafeAttachmentSegment("bad\0name")).toBe(false);
  });
});
