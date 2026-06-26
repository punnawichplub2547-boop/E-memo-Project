import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getActiveSessionUserFromToken } from "@/lib/auth";
import {
  createItemSubcategory,
  listItemSubcategories,
  type ItemSubcategoryInput,
} from "@/lib/db-item-subcategories";
import { isApprovalCategory } from "@/lib/item-subcategories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const forbidden = await requireAdmin(req);
  if (forbidden) return forbidden;

  try {
    const items = await listItemSubcategories();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/admin/item-subcategories]", error);
    return NextResponse.json({ error: "Unable to load item subcategories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin(req);
  if (forbidden) return forbidden;

  const input = await parseInput(req);
  if ("error" in input) return input.error;

  try {
    const item = await createItemSubcategory(input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/item-subcategories]", error);
    return NextResponse.json({ error: "Unable to create item subcategory" }, { status: 500 });
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
