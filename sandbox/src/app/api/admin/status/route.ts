import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    thaillm: !!process.env.THAILLM_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
  });
}
