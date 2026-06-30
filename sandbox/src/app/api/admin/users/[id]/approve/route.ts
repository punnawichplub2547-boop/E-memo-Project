import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { approveUser } from "@/lib/db-users";

const ALLOWED_ROLES = new Set(["requester", "manager", "general-manager", "managing-director", "read-recipient", "admin"]);
const ALLOWED_APPROVAL_LEVELS = new Set(["Manager / Top Section", "General Manager", "Managing Director"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session?.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const userId = Number((await params).id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    const body = await req.json() as { roles?: string[]; approvalLevel?: string | null };
    const roles = Array.isArray(body.roles) && body.roles.length > 0 ? body.roles : ["requester"];
    if (roles.some(role => !ALLOWED_ROLES.has(role))) {
      return NextResponse.json({ error: "Invalid roles" }, { status: 400 });
    }
    if (body.approvalLevel !== undefined && body.approvalLevel !== null && !ALLOWED_APPROVAL_LEVELS.has(body.approvalLevel)) {
      return NextResponse.json({ error: "Invalid approval level" }, { status: 400 });
    }
    await approveUser(userId, roles, body.approvalLevel ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/users/[id]/approve]", err);
    return NextResponse.json({ error: "Failed to approve user" }, { status: 500 });
  }
}
