import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyPassword, COOKIE_NAME } from "@/lib/auth";
import { findUserByEmail, parseRoles } from "@/lib/db-users";

const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

function shouldUseSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE) {
    return process.env.AUTH_COOKIE_SECURE === "true";
  }
  return process.env.NODE_ENV === "production";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (user.status === "pending") {
      return NextResponse.json({ error: "Your account is awaiting admin approval" }, { status: 403 });
    }
    if (user.status === "suspended") {
      return NextResponse.json({ error: "Your account has been suspended. Contact HR&GA." }, { status: 403 });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const roles = parseRoles(user.roles_json);
    const token = await signToken({
      userId: user.id,
      employeeCardId: user.employee_card_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      department: user.department,
      roles,
      approvalLevel: user.approval_level,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
