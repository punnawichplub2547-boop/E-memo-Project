import { NextRequest, NextResponse } from "next/server";
import { callThaiLLM } from "@/lib/ai/thaillm";
import { callGroq } from "@/lib/ai/groq";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { provider, prompt, userId, feature } = body as Record<string, string>;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (provider !== "thaillm" && provider !== "groq") {
    return NextResponse.json({ error: "unsupported provider — use 'thaillm' or 'groq'" }, { status: 400 });
  }

  const messages = [{ role: "user" as const, content: prompt }];
  const feat = feature ?? "test";

  try {
    const result = provider === "thaillm"
      ? await callThaiLLM({ messages, userId, feature: feat })
      : await callGroq({ messages, userId, feature: feat });

    return NextResponse.json({ message: result.text, usage: result.usage });
  } catch {
    // Do not leak raw error details to the frontend
    return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }
}
