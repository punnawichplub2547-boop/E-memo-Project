import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { callGroq } from "@/lib/ai/groq";

export async function POST(req: NextRequest) {
  const session = await getActiveSessionUserFromToken(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "not_configured" });
  }

  const { query, memos } = await req.json();
  if (!query?.trim() || !Array.isArray(memos) || memos.length === 0) {
    return NextResponse.json({ error: "invalid_input" });
  }

  const memoList = memos
    .map((m: { id: string; title: string; department: string; category: string; amount: number; status: string; requester: string; description?: string }) =>
      `ID:${m.id} | ${m.title} | แผนก:${m.department} | หมวด:${m.category} | ฿${m.amount.toLocaleString()} | สถานะ:${m.status} | ผู้ขอ:${m.requester}${m.description ? ` | ${m.description.slice(0, 80)}` : ""}`
    )
    .join("\n");

  const prompt = `You are a search assistant for a Thai company's internal memo system. The user searches in Thai or English.

User query: "${query}"

Available memos:
${memoList}

Return ONLY a JSON object — no explanation, no markdown:
{"ids":["EM-2026-001","EM-2026-002"],"summary":"..."}

Rules:
- "ids": array of memo IDs ranked by relevance to the query, most relevant first. Include only relevant memos. Return [] if none match.
- "summary": 1-2 sentences in Thai summarizing what was found and why it matches the query.`;

  try {
    const { text } = await callGroq({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 512,
      temperature: 0.1,
      feature: "ai-search",
    });

    // Strip markdown fences if present
    const cleaned = text.replace(/```(?:json)?/gi, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("Groq unexpected response:", text);
      return NextResponse.json({ error: "parse_error" });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json({
      ids: Array.isArray(parsed.ids) ? parsed.ids : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429")) return NextResponse.json({ error: "quota_exceeded" });
    console.error("Groq fetch error:", msg);
    return NextResponse.json({ error: "api_error" });
  }
}
