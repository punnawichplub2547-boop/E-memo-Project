import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  inferAttachmentContentType,
  isSafeAttachmentSegment,
  sanitizeAttachmentFileName,
} from "@/lib/attachments";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { loadMemoRecord } from "@/lib/db-memos";
import { canDownloadAttachment } from "@/lib/attachment-access";
import { isMemoVisibleTo } from "@/lib/memo-visibility";
import type { MemoRecord } from "@/lib/approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prototype-local attachment download/open. Files live on disk under
// <cwd>/storage/attachments/<memoId>/<storedName>. This is not production
// document management — see docs/server-deploy.md for the persistence note.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memoId: string; storedName: string }> },
) {
  const { memoId: rawMemoId, storedName: rawStoredName } = await params;
  const memoId = decodeURIComponent(rawMemoId);
  const storedName = decodeURIComponent(rawStoredName);

  // First gate: reject any segment that is empty, "." / "..", or carries a separator/NUL.
  if (!isSafeAttachmentSegment(memoId) || !isSafeAttachmentSegment(storedName)) {
    return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
  }

  // Authorization gate — runs BEFORE any disk read. Login alone is not enough:
  // the session must be able to see this memo, and the storedName must be a
  // listed attachment of it.
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let memo: MemoRecord | null;
  try {
    memo = await loadMemoRecord(memoId);
  } catch (error) {
    console.error("[GET /api/attachments/:memoId/:storedName] load memo", error);
    return NextResponse.json({ error: "Unable to read attachment" }, { status: 500 });
  }
  if (!memo) {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }
  if (!canDownloadAttachment(memo, session, storedName)) {
    // Not visible → 403 (you may not see this memo at all). Visible but the
    // storedName is not a listed attachment → 404 (no such file on the memo).
    if (!isMemoVisibleTo(memo, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Mirror the directory naming the POST route used when storing the file.
  const safeMemoId = sanitizeAttachmentFileName(memoId);
  const memoDir = path.resolve(process.cwd(), "storage", "attachments", safeMemoId);
  const filePath = path.resolve(memoDir, storedName);

  // Defense-in-depth: the resolved file must stay directly inside the memo directory.
  const relative = path.relative(memoDir, filePath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) {
    return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
  }

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    const bytes = await readFile(filePath);
    const downloadName = sanitizeAttachmentFileName(storedName);
    // HTTP header values are Latin-1; Thai (and other non-ASCII) filenames must use the
    // RFC 6266 dual form: an ASCII-safe fallback plus a UTF-8 filename*.
    const asciiName = downloadName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": inferAttachmentContentType(storedName),
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(stats.size),
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    console.error("[GET /api/attachments/:memoId/:storedName]", error);
    return NextResponse.json({ error: "Unable to read attachment" }, { status: 500 });
  }
}
