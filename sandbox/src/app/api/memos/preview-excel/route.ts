// Renders the F-DC-006 Excel form from a memo that has not been saved yet, so a
// requester can check the printed form before sending it into the workflow.
//
// It shares memoToExcelBuffer with /api/memos/[id]/export-excel on purpose: one
// generator, so a previewed form can never drift from the real one. The only
// difference is where the MemoRecord comes from — here it arrives in the request
// body instead of the database, and no signatures exist yet.
//
// This route reads nothing, writes nothing, and persists nothing. The caller
// sends their own draft and gets it back as a file.
import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { memoToExcelBuffer } from "@/lib/export/memo-excel";
import type { MemoRecord } from "@/lib/approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upper bound on any array in the posted record. The form cannot realistically
 *  produce this many rows; the cap exists so one logged-in user cannot spend
 *  unbounded server CPU laying out a spreadsheet. */
const MAX_ROWS = 200;

const REQUIRED_STRINGS = [
  "id", "title", "requester", "department", "category", "status", "currentStep", "createdAt", "updatedAt",
] as const;
const REQUIRED_NUMBERS = ["amount", "cycleHours"] as const;

function validationError(memo: unknown): string | null {
  if (typeof memo !== "object" || memo === null || Array.isArray(memo)) {
    return "memo must be an object";
  }
  const record = memo as Record<string, unknown>;
  for (const key of REQUIRED_STRINGS) {
    if (typeof record[key] !== "string") return `${key} must be a string`;
  }
  for (const key of REQUIRED_NUMBERS) {
    if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      return `${key} must be a number`;
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value) && value.length > MAX_ROWS) {
      return `${key} exceeds ${MAX_ROWS} rows`;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const memo = (body as { memo?: unknown } | null)?.memo;
    const invalid = validationError(memo);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    // No signatures: nothing on this memo has been approved, and the form's
    // signature boxes are meant to be blank until someone actually signs.
    const buffer = await memoToExcelBuffer(memo as MemoRecord, []);

    // A draft has no memo number yet (Ref.No is blank on the sheet), so the file
    // cannot be named after one. In revision mode the memo already has an id and
    // the name matches what the queue download produces.
    const id = (memo as MemoRecord).id;
    const safeId = id.replace(/[^A-Za-z0-9_-]/g, "_");
    const filename = safeId ? `memo-${safeId}.xlsx` : "memo-draft.xlsx";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[POST /api/memos/preview-excel]", error);
    return NextResponse.json({ error: "Unable to build the preview" }, { status: 500 });
  }
}
