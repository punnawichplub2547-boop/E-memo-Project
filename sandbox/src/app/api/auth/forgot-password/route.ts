import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db-users";
import { createPasswordResetToken, hasRecentResetToken } from "@/lib/password-reset";
import { sendEmailMessage } from "@/lib/email/client";
import { wrapEmailHtml, wrapEmailText } from "@/lib/email/template";

export const dynamic = "force-dynamic";

// Always answers 200 for a well-formed email so the response cannot be used to
// enumerate which addresses have accounts. A reset link is only sent when the
// address belongs to an active account.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    // Skip silently if an account already got a reset link inside the cooldown
    // window — throttles spam without changing the response (no enumeration).
    if (user && user.status === "active" && !(await hasRecentResetToken(user.id))) {
      const rawToken = await createPasswordResetToken(user.id);
      const base = (process.env.APP_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
      const link = `${base}/reset-password?token=${rawToken}`;
      const name = `${user.first_name} ${user.last_name}`.trim();
      const safeName = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeLink = link.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      await sendEmailMessage({
        to: user.email,
        subject: "รีเซ็ตรหัสผ่าน E-Memo / Reset your E-Memo password",
        text: wrapEmailText(
          `เรียน ${name}\n\n` +
          `มีการขอรีเซ็ตรหัสผ่านสำหรับบัญชี E-Memo ของคุณ คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 60 นาที):\n` +
          `${link}\n\n` +
          `หากคุณไม่ได้เป็นผู้ขอ ให้เพิกเฉยอีเมลนี้ได้เลย`,
        ),
        html: wrapEmailHtml(
          `<p style="margin:0 0 12px;">เรียน ${safeName}</p>` +
          `<p style="margin:0 0 16px;">มีการขอรีเซ็ตรหัสผ่านสำหรับบัญชี E-Memo ของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 60 นาที)</p>` +
          `<p style="margin:0 0 16px;"><a href="${safeLink}" style="display:inline-block;background:#1F3864;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">ตั้งรหัสผ่านใหม่ / Reset password</a></p>` +
          `<p style="margin:0;color:#6b7280;font-size:12px;">หากคุณไม่ได้เป็นผู้ขอ ให้เพิกเฉยอีเมลนี้ได้เลย</p>`,
          { heading: "รีเซ็ตรหัสผ่าน E-Memo" },
        ),
      });
    }

    // Same response whether or not an account exists.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json({ error: "Unable to process the request" }, { status: 500 });
  }
}
