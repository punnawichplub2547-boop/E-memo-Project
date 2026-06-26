import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import { setItemSubcategoryActive, updateItemSubcategory, type ItemSubcategoryInput } from "@/lib/db-item-subcategories";
import { isApprovalCategory } from "@/lib/item-subcategories";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const forbidden = await requireAdmin(req);
  if (forbidden) return forbidden;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const input = await parseInput(req);
  if ("error" in input) return input.error;

  try {
    const item = await updateItemSubcategory(id, input);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[PUT /api/admin/item-subcategories/[id]]", error);
    return NextResponse.json({ error: "Unable to update item subcategory" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const forbidden = await requireAdmin(req);
  if (forbidden) return forbidden;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json() as { isActive?: boolean };
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive is required" }, { status: 400 });
  }

  try {
    await setItemSubcategoryActive(id, body.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/item-subcategories/[id]]", error);
    return NextResponse.json({ error: "Unable to update item subcategory status" }, { status: 500 });
  }
}

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await getActiveSessionUserFromToken(token);
  if (!session?.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function parseInput(req: NextRequest): Promise<ItemSubcategoryInput | { error: NextResponse }> {
  const body = await req.json() as Partial<ItemSubcategoryInput>;
  if (!isApprovalCategory(body.categoryKey)) {
    return { error: NextResponse.json({ error: "Invalid category" }, { status: 400 }) };
  }
  const labelTh = String(body.labelTh ?? "").trim();
  if (!labelTh) {
    return { error: NextResponse.json({ error: "labelTh is required" }, { status: 400 }) };
  }
  return {
    categoryKey: body.categoryKey,
    labelTh,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: body.isActive !== false,
  };
}
