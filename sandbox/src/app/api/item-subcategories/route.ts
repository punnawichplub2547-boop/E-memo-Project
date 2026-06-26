import { NextRequest, NextResponse } from "next/server";
import type { ApprovalCategory } from "@/lib/approval";
import { listActiveItemSubcategoriesWithFallback } from "@/lib/db-item-subcategories";
import { isApprovalCategory } from "@/lib/item-subcategories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  if (!isApprovalCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    const items = await listActiveItemSubcategoriesWithFallback(category as ApprovalCategory);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/item-subcategories]", error);
    return NextResponse.json({ error: "Unable to load item subcategories" }, { status: 500 });
  }
}
