import { normalizeUsage, type Messages, type NormalizedUsage } from "./token-usage";
import { logAiUsage } from "./usage-logger";

export interface GroqResult {
  text: string;
  usage: NormalizedUsage;
}

export interface GroqCallOptions {
  messages: Messages;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  feature: string;
}

export async function callGroq(opts: GroqCallOptions): Promise<GroqResult> {
  // Read env vars inside function — avoids stale module-level values on hot-reload
  const key = process.env.GROQ_API_KEY;
  const baseUrl = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  if (!key) throw new Error("GROQ_API_KEY not configured");

  const start = Date.now();
  let requestStatus: "success" | "error" = "success";
  let errorMessage: string | undefined;
  let text = "";
  let usage: NormalizedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, source: "estimated" };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.1,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    text = data?.choices?.[0]?.message?.content ?? "";
    // Groq returns official usage — prefer it over estimated
    usage = normalizeUsage({ providerUsage: data?.usage ?? null, messages: opts.messages, outputText: text });
    return { text, usage };
  } catch (err) {
    requestStatus = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    logAiUsage({
      userId: opts.userId,
      feature: opts.feature,
      provider: "groq",
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      usageSource: usage.source,
      requestStatus,
      latencyMs: Date.now() - start,
      errorMessage,
      createdAt: new Date().toISOString(),
    });
  }
}
