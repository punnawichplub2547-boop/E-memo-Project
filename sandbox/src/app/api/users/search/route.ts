import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-jwt";
import { getActiveSessionUserFromToken } from "@/lib/auth";
import { searchActiveUsers } from "@/lib/db-users";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  // Anything other than the explicit "approver" opt-in keeps the CC-picker scope.
  const scope = request.nextUrl.searchParams.get("scope") === "approver" ? "approver" : "cc";
  try {
    const users = await searchActiveUsers(q, scope);
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
