import { normalizeUsage, type Messages, type NormalizedUsage } from "./token-usage";
import { logAiUsage } from "./usage-logger";

export interface ThaiLLMResult {
  text: string;
  usage: NormalizedUsage;
}

export interface ThaiLLMCallOptions {
  messages: Messages;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  feature: string;
}

export async function callThaiLLM(opts: ThaiLLMCallOptions): Promise<ThaiLLMResult> {
  // Read env vars inside function — avoids stale module-level values on hot-reload
  const key = process.env.THAILLM_API_KEY;
  const baseUrl = process.env.THAILLM_BASE_URL ?? "http://thaillm.or.th/api/v1";
  const model = process.env.THAILLM_MODEL ?? "openthaigpt";

  if (!key) throw new Error("THAILLM_API_KEY not configured");

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
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.3,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ThaiLLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    text = data?.choices?.[0]?.message?.content ?? "";
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
      provider: "thaillm",
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
