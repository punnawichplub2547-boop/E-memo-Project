import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { isMemoVisibleTo } from "@/lib/memo-visibility";
import { memoToExcelBuffer } from "@/lib/export/memo-excel";
import { loadMemoForExport } from "@/lib/export/load-memo-export";
import { getEmailConfig, sendEmailMessage } from "@/lib/email/client";
import { wrapEmailHtml, wrapEmailText } from "@/lib/email/template";
import { parseRecipientEmails } from "@/lib/email/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Emails a memo as an .xlsx attachment (same F-DC-006 layout as the queue download)
// to one or more free-typed recipients. Permission mirrors the download route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: memoNo } = await params;
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { to?: string };
    try {
      body = (await request.json()) as { to?: string };
    } catch {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const { emails, invalid } = parseRecipientEmails(body.to ?? "");
    if (emails.length === 0) {
      return NextResponse.json({ error: "No valid recipient email", invalid }, { status: 400 });
    }

    if (getEmailConfig() === null) {
      return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
    }

    const loaded = await loadMemoForExport(memoNo, getDbPool());
    if (!loaded) return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    const { memo, signatures } = loaded;

    if (!session.roles.includes("admin") && !isMemoVisibleTo(memo, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await memoToExcelBuffer(memo, signatures);
    const safeName = memoNo.replace(/[^A-Za-z0-9_-]/g, "_");
    const filename = `memo-${safeName}.xlsx`;
    const subject = `[E-Memo] ${memo.id} ${memo.title}`;
    const senderName = `${session.firstName} ${session.lastName}`;
    const text = wrapEmailText(
      `เอกสารเมโม ${memo.id} (${memo.title}) แนบมาในรูปแบบ Excel\n` +
      `ส่งจากระบบ HR&GA E-Memo โดย ${senderName}`,
    );
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = wrapEmailHtml(
      `<p style="margin:0 0 8px;">เอกสารเมโม <b>${esc(memo.id)}</b> (${esc(memo.title)}) แนบมาในรูปแบบ Excel</p>` +
      `<p style="margin:0;color:#6b7280;font-size:12px;">ส่งจากระบบ HR&amp;GA E-Memo โดย ${esc(senderName)}</p>`,
      { heading: "เอกสารเมโม (Excel)" },
    );

    // One message per recipient so addresses are not exposed to each other.
    const sent: string[] = [];
    const failed: string[] = [];
    for (const to of emails) {
      const result = await sendEmailMessage({
        to,
        subject,
        text,
        html,
        attachments: [{ filename, content: buffer }],
      });
      (result ? sent : failed).push(to);
    }

    if (sent.length === 0) {
      return NextResponse.json({ error: "All sends failed", failed }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent, failed, invalid });
  } catch (error) {
    console.error("[POST /api/memos/[id]/email-excel]", error);
    return NextResponse.json({ error: "Unable to email memo" }, { status: 500 });
  }
}
