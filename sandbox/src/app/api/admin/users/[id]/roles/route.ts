import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { updateUserRoles, updateUserStatus } from "@/lib/db-users";

const ALLOWED_ROLES = new Set(["requester", "manager", "general-manager", "senior-general-manager", "managing-director", "read-recipient", "admin"]);
const ALLOWED_APPROVAL_LEVELS = new Set(["Manager / Top Section", "General Manager", "Managing Director"]);
const ALLOWED_STATUSES = new Set(["active", "suspended"]);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session?.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await req.json() as {
      roles?: string[];
      approvalLevel?: string | null;
      status?: "active" | "suspended";
    };
    if (body.roles !== undefined) {
      if (!Array.isArray(body.roles) || body.roles.length === 0 || body.roles.some(role => !ALLOWED_ROLES.has(role))) {
        return NextResponse.json({ error: "Invalid roles" }, { status: 400 });
      }
      if (body.approvalLevel !== undefined && body.approvalLevel !== null && !ALLOWED_APPROVAL_LEVELS.has(body.approvalLevel)) {
        return NextResponse.json({ error: "Invalid approval level" }, { status: 400 });
      }
      await updateUserRoles(Number(id), body.roles, body.approvalLevel ?? null);
    }
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      await updateUserStatus(Number(id), body.status);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/admin/users/[id]/roles]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
