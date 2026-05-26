import { NextRequest, NextResponse } from "next/server";
import { callThaiLLM } from "@/lib/ai/thaillm";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 3000;

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
}

function extractJson(text: string): unknown {
  const cleaned = stripThink(text).replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // Find the LAST {...} block in case the model emits one inside <think> too
  const matches = [...cleaned.matchAll(/\{[\s\S]*?\}/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    try { return JSON.parse(matches[i][0]); } catch { /* try next */ }
  }
  // Fallback: greedy match (catches multi-line JSON with nested objects)
  const greedy = cleaned.match(/\{[\s\S]*\}/);
  if (greedy) { try { return JSON.parse(greedy[0]); } catch { /* fall through */ } }
  return null;
}

export async function POST(req: NextRequest) {
  if (!process.env.THAILLM_API_KEY) {
    return NextResponse.json({ error: "not_configured" });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "pdf_only" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  // Extract text from PDF using pdf-parse (CommonJS module, must use require)
  let pdfText = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    pdfText = result.text ?? "";
  } catch (err) {
    console.error("pdf-parse error:", err);
    return NextResponse.json({ error: "pdf_parse_error" }, { status: 500 });
  }

  if (!pdfText.trim()) {
    return NextResponse.json({ error: "no_text_in_pdf" });
  }

  const truncated = pdfText.slice(0, MAX_TEXT_CHARS);

  // PROMPT STRATEGY (for OpenThaiGPT 8B — small models need scaffolding):
  // 1. Semantic anchor (who-pays-whom) > visual anchor (letterhead)
  // 2. Few-shot worked example with the exact failure mode (Customer Name field)
  // 3. Direct "JSON:" cue at the end — do NOT mention <think> in the prompt.
  //    Explicit <think> permission causes the model to put answer inside <think>
  //    and stop without emitting JSON. The model still naturally emits <think>
  //    blocks (r1-style training) and our extractJson() strips them.
  // 4. Explicit negative rules with the literal field labels seen in Thai/EN quotes
  const prompt = `คุณคือผู้เชี่ยวชาญด้านการอ่านใบเสนอราคา (vendor quotation) ภาษาไทย/อังกฤษ
ภารกิจ: ดึงข้อมูลจากเอกสารและตอบเป็น JSON

═══ หลักการสำคัญที่สุด ═══
ใบเสนอราคาทุกฉบับมี "2 บริษัท" เสมอ — ห้ามสับสน:

【ผู้ขาย / VENDOR / SELLER】 = บริษัทที่ "จะได้รับเงิน"
- เป็นผู้ออกและเซ็นใบเสนอราคานี้
- ชื่อปรากฏในหัวกระดาษ (letterhead) ด้านบน คู่กับโลโก้ ที่อยู่ Tax ID เบอร์โทร อีเมลของบริษัทตัวเอง
- มักมี Sales Person / Account Manager ของบริษัทตัวเอง
- ★ คือคำตอบที่เราต้องการ ★

【ลูกค้า / CUSTOMER / BUYER】 = บริษัทที่ "จะจ่ายเงิน"
- เป็นผู้รับใบเสนอราคา
- ชื่อปรากฏ "หลัง" ป้ายกำกับเหล่านี้เท่านั้น:
  "Customer Name:" / "Customer:" / "Company:" / "Bill To:" / "Sold To:" /
  "ชื่อลูกค้า:" / "บริษัท (ลูกค้า):" / "เรียน:" / "To:" / "ส่งถึง:" /
  "Customer ID:" / "Customer No.:"
- ✗ ห้ามใช้เป็น vendor เด็ดขาด ✗

═══ ตัวอย่าง ═══
ข้อความเอกสาร:
"""
@Pakin Tech
ADD PAKIN TECH COMPANY LIMITED
420/138 Kanchanaphisek Road, Bangkok 10250
Tax ID : 0105560108455
Sales Person : Wisanu Pisaigul   Tel : 064-745-0529
Quotation   QT No : Q2602-017   Date : 16/02/2026

Customer Name : Complete Auto Rubber Manufacturing Co.,Ltd.
Attention : Dear K.Chakrit
Customer ID : C 230

Item: Microsoft 365 Business   Qty: 20   Unit Price: 8,250   Amount: 165,000
Total : 165,000 THB
"""

JSON ที่ถูกต้อง:
{"vendor":"ADD PAKIN TECH COMPANY LIMITED","items":[{"name":"Microsoft 365 Business","qty":20,"unit":"license","unitPrice":8250}],"totalAmount":165000}

(สังเกต: "Complete Auto Rubber..." อยู่หลัง "Customer Name :" และมี "Customer ID" → คือลูกค้า ห้ามใช้เป็น vendor)

═══ งานจริงของคุณ ═══
ข้อความเอกสาร:
"""
${truncated}
"""

กฎเด็ดขาด:
- vendor = ผู้ออกใบเสนอราคา (อยู่ในหัวกระดาษ พร้อม Tax ID/Sales Person ของตัวเอง) — ห้ามใช้ชื่อหลัง "Customer Name:", "Customer:", "Company:", "ชื่อลูกค้า:", "เรียน:", "To:"
- qty, unitPrice, totalAmount: ตัวเลขล้วน ไม่มี comma ไม่มีสกุลเงิน
- หาไม่พบ → ใช้ "" หรือ 0

ตอบเป็น JSON ทันที (เริ่มด้วย { และจบด้วย } — ห้ามอธิบายก่อนหรือหลัง):
JSON:`;

  try {
    const { text } = await callThaiLLM({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048, // bumped from 1024 — <think> block + JSON needs more headroom
      temperature: 0.1,
      feature: "pdf-extract",
    });

    if (!text) {
      return NextResponse.json({ error: "quota_exceeded" });
    }

    const parsed = extractJson(text) as {
      vendor?: string;
      items?: Array<{ name?: string; qty?: number; unit?: string; unitPrice?: number }>;
      totalAmount?: number;
    } | null;

    if (!parsed) {
      console.error("pdf-extract unexpected response:", text);
      return NextResponse.json({ error: "parse_error" });
    }

    return NextResponse.json({
      vendor: typeof parsed.vendor === "string" ? parsed.vendor.trim() : "",
      items: Array.isArray(parsed.items)
        ? parsed.items.map((it) => ({
            name: String(it.name ?? "").trim(),
            qty: Number(it.qty) || 1,
            unit: String(it.unit ?? "ชิ้น").trim(),
            unitPrice: Number(it.unitPrice) || 0,
          }))
        : [],
      totalAmount: Number(parsed.totalAmount) || 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429")) return NextResponse.json({ error: "quota_exceeded" });
    console.error("pdf-extract fetch error:", msg);
    return NextResponse.json({ error: "api_error" });
  }
}
