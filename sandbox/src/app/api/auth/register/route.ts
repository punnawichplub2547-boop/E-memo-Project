import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { createUser, findUserByEmail, findUserByEmployeeCardId } from "@/lib/db-users";

const ALLOWED_EMAIL_DOMAIN = "@car-1996.com";
const CARD_ID_REGEX = /^[A-Za-z0-9]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      employeeCardId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      password?: string;
      department?: string;
    };

    const { employeeCardId, email, firstName, lastName, password, department } = body;
    const normalizedEmail = (email ?? "").trim().toLowerCase();

    if (!employeeCardId || !email || !firstName || !lastName || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (!CARD_ID_REGEX.test(employeeCardId)) {
      return NextResponse.json({ error: "Employee card ID must be letters and numbers only" }, { status: 400 });
    }
    if (!normalizedEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      return NextResponse.json({ error: `Email must be a company address ending in ${ALLOWED_EMAIL_DOMAIN}` }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const [existingEmail, existingCard] = await Promise.all([
      findUserByEmail(normalizedEmail),
      findUserByEmployeeCardId(employeeCardId),
    ]);
    if (existingEmail) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    if (existingCard) {
      return NextResponse.json({ error: "An account with this employee card ID already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    await createUser({
      employeeCardId,
      email: normalizedEmail,
      firstName,
      lastName,
      passwordHash,
      department: department ?? "",
    });

    return NextResponse.json({ message: "Registration submitted. Awaiting admin approval." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
