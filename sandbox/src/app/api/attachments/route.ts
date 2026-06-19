import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { MemoAttachment } from "@/lib/approval";
import {
  isAllowedAttachmentFile,
  MAX_ATTACHMENT_BYTES,
  sanitizeAttachmentFileName,
} from "@/lib/attachments";
import { formatTimestamp } from "@/lib/format-timestamp";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { loadMemoRecord } from "@/lib/db-memos";
import { canUploadAttachment } from "@/lib/attachment-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Auth gate — login alone is not enough. The session must own the memo
    // (or be admin) to attach to an EXISTING memo. A not-yet-persisted memo
    // (create flow uploads before the row exists) is session-only.
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const memoId = sanitizeAttachmentFileName(String(formData.get("memoId") ?? ""));
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (!memoId || memoId === "attachment") {
      return NextResponse.json({ error: "memoId is required" }, { status: 400 });
    }

    // memo == null → not yet persisted (create flow) → session-only allow.
    // memo != null → owner/admin only.
    const memo = await loadMemoRecord(memoId);
    if (!canUploadAttachment(memo, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (files.length === 0) {
      return NextResponse.json({ attachments: [] satisfies MemoAttachment[] });
    }

    const memoDir = path.join(process.cwd(), "storage", "attachments", memoId);
    await mkdir(memoDir, { recursive: true });

    const uploadedAt = formatTimestamp(new Date());
    const attachments: MemoAttachment[] = [];

    for (const file of files) {
      const originalName = sanitizeAttachmentFileName(file.name);
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: `${originalName} exceeds 10 MB` }, { status: 413 });
      }
      if (!isAllowedAttachmentFile(originalName, file.type)) {
        return NextResponse.json({ error: `${originalName} is not an allowed attachment type` }, { status: 415 });
      }

      const id = randomUUID();
      const storedName = `${id}-${originalName}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(memoDir, storedName), bytes);
      attachments.push({
        id,
        originalName,
        storedName,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedAt,
      });
    }

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[POST /api/attachments]", error);
    return NextResponse.json({ error: "Unable to upload attachments" }, { status: 500 });
  }
}
