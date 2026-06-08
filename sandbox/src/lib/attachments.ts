export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["pdf", "xls", "xlsx", "doc", "docx", "png", "jpg", "jpeg"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

export function sanitizeAttachmentFileName(name: string): string {
  const baseName = name.split(/[\\/]+/).pop() ?? "";
  const sanitized = baseName
    .trim()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/-\./g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
  return sanitized || "attachment";
}

export function getAttachmentExtension(name: string): string {
  const sanitized = sanitizeAttachmentFileName(name);
  const idx = sanitized.lastIndexOf(".");
  return idx === -1 ? "" : sanitized.slice(idx + 1).toLowerCase();
}

export function isAllowedAttachmentFile(name: string, mimeType: string): boolean {
  const extension = getAttachmentExtension(name);
  if (!ALLOWED_EXTENSIONS.has(extension)) return false;
  return mimeType === "" || ALLOWED_MIME_TYPES.has(mimeType);
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export function inferAttachmentContentType(name: string): string {
  return EXTENSION_CONTENT_TYPES[getAttachmentExtension(name)] ?? "application/octet-stream";
}

// Validates a single path segment (memoId or storedName) for safe filesystem use.
// Rejects empty values, "." / "..", and anything containing a path separator or NUL.
// Pure string logic — no node:path import — so this stays usable from client bundles.
export function isSafeAttachmentSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatCompact(kb)} KB`;
  return `${formatCompact(kb / 1024)} MB`;
}

function formatCompact(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
