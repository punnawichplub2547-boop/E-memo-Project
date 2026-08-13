import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeAttachmentFileName, isSafeAttachmentSegment } from "@/lib/attachments";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { validateNotifyNoteImageFiles, type NotifyNoteImage } from "@/lib/notify-note";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รูปของ short note เก็บแยกจาก storage/attachments โดยตั้งใจ: ไฟล์แนบเป็นส่วนหนึ่งของ
// เอกสารและถูกแสดงใน queue drawer ส่วนรูปนี้เป็นของการแจ้งเตือนล้วนๆ ถ้าเก็บที่เดียวกัน
// มันจะไปโผล่ในหัวข้อ "ไฟล์แนบ" ของเมโม ซึ่งขัดกับ Q14
export async function POST(request: NextRequest) {
  try {
    // อัปโหลดเกิดก่อนแถว memo ถูกสร้าง (เหมือน flow ของไฟล์แนบ) จึงตรวจได้แค่ว่ามี session
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const rawMemoId = String(formData.get("memoId") ?? "");
    const memoId = sanitizeAttachmentFileName(rawMemoId);
    if (!memoId || memoId === "attachment" || !isSafeAttachmentSegment(memoId) || memoId !== rawMemoId) {
      return NextResponse.json({ error: "memoId is required" }, { status: 400 });
    }

    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) return NextResponse.json({ images: [] satisfies NotifyNoteImage[] });

    const validation = validateNotifyNoteImageFiles(
      files.map((file) => ({ name: sanitizeAttachmentFileName(file.name), type: file.type, size: file.size })),
    );
    if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: 400 });

    const dir = path.join(process.cwd(), "storage", "notify-notes", memoId);
    await mkdir(dir, { recursive: true });

    const images: NotifyNoteImage[] = [];
    for (const file of files) {
      const originalName = sanitizeAttachmentFileName(file.name);
      const id = randomUUID();
      const storedName = `${id}-${originalName}`;
      await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
      images.push({
        id,
        originalName,
        storedName,
        size: file.size,
        mimeType: file.type || "image/png",
      });
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("[POST /api/notify-note-images]", error);
    return NextResponse.json({ error: "Unable to upload images" }, { status: 500 });
  }
}
