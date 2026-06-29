import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db-users";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmailMessage } from "@/lib/email/client";

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
    if (user && user.status === "active") {
      const rawToken = await createPasswordResetToken(user.id);
      const base = (process.env.APP_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
      const link = `${base}/reset-password?token=${rawToken}`;
      const name = `${user.first_name} ${user.last_name}`.trim();
      await sendEmailMessage({
        to: user.email,
        subject: "รีเซ็ตรหัสผ่าน E-Memo / Reset your E-Memo password",
        text:
          `เรียน ${name}\n\n` +
          `มีการขอรีเซ็ตรหัสผ่านสำหรับบัญชี E-Memo ของคุณ คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 60 นาที):\n` +
          `${link}\n\n` +
          `หากคุณไม่ได้เป็นผู้ขอ ให้เพิกเฉยอีเมลนี้ได้เลย\n`,
      });
    }

    // Same response whether or not an account exists.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json({ error: "Unable to process the request" }, { status: 500 });
  }
}
