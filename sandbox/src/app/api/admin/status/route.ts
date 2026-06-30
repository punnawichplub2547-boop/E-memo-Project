import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getActiveSessionUserFromToken(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    thaillm: !!process.env.THAILLM_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
  });
}
