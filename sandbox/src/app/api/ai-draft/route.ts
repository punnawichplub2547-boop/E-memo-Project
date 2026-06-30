import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";
import { callThaiLLM } from "@/lib/ai/thaillm";

const CATEGORY_LABELS: Record<string, string> = {
  "raw-material": "วัตถุดิบ",
  "fixed-asset": "สินทรัพย์ถาวร",
  "service-contract": "จ้างบริการ",
  "general-purchase": "ซื้อทั่วไป",
  "mold": "แม่พิมพ์",
};

function extractJson(text: string): { subject: string; description: string } | null {
  // Strip <think>...</think> reasoning block (some models output this before the answer)
  const noThink = text.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
  // Strip markdown fences anywhere in the text
  const stripped = noThink.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  // Extract first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getActiveSessionUserFromToken(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.THAILLM_API_KEY) {
    return NextResponse.json({ error: "not_configured" });
  }

  const { category, amount, department, budgetStatus } = await req.json();

  const budgetLabel =
    budgetStatus === "in-budget" ? "ในงบ" :
    budgetStatus === "over-budget" ? "เกินงบ" : "ไม่มีงบ";

  const prompt = `ร่าง Internal Memo ภาษาไทยสำหรับบริษัทผลิตในประเทศไทย
ข้อมูล:
- หมวด: ${CATEGORY_LABELS[category] ?? category}
- วงเงิน: ${Number(amount).toLocaleString("th-TH")} บาท
- แผนก: ${department}
- งบประมาณ: ${budgetLabel}

ตอบเป็น JSON object เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON:
{"subject":"...","description":"..."}

กฎ:
- subject: หัวเรื่อง Memo 1 บรรทัด เริ่มด้วย "ขออนุมัติ..."
- description: เหตุผล 2-3 ประโยค ภาษาไทย เป็นทางการ`;

  try {
    const { text } = await callThaiLLM({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1024,
      temperature: 0.3,
      feature: "memo-draft",
    });

    if (text === "") {
      return NextResponse.json({ error: "quota_exceeded" });
    }

    const parsed = extractJson(text);
    if (!parsed?.subject || !parsed?.description) {
      console.error("ThaiLLM unexpected response:", text);
      return NextResponse.json({ error: "parse_error" });
    }

    return NextResponse.json({
      subject: parsed.subject.trim(),
      description: parsed.description.trim(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429")) return NextResponse.json({ error: "quota_exceeded" });
    console.error("ThaiLLM fetch error:", msg);
    return NextResponse.json({ error: "api_error" });
  }
}
