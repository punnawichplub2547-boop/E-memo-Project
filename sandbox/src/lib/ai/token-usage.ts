// gpt-tokenizer uses cl100k_base (GPT-4 encoding).
// ThaiLLM (OpenThaiGPT) and Groq Llama models have their own tokenizers,
// so counts here are APPROXIMATE — for internal monitoring only, not billing.
import { encode } from "gpt-tokenizer";

export type Messages = Array<{ role: string; content: string }>;

export interface NormalizedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  source: "provider" | "estimated";
}

export function countTextTokens(text: string): number {
  try {
    return encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

// Each message carries ~4 tokens of overhead (role tag + formatting).
export function countMessagesTokens(messages: Messages): number {
  return messages.reduce((sum, m) => sum + countTextTokens(m.content) + 4, 0) + 2;
}

interface NormalizeUsageInput {
  providerUsage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  messages?: Messages;
  promptText?: string;
  outputText?: string;
}

// Prefer official provider usage when available; fall back to gpt-tokenizer estimate.
export function normalizeUsage({ providerUsage, messages, promptText, outputText }: NormalizeUsageInput): NormalizedUsage {
  if (providerUsage?.prompt_tokens != null) {
    const p = providerUsage.prompt_tokens;
    const c = providerUsage.completion_tokens ?? 0;
    return {
      promptTokens: p,
      completionTokens: c,
      totalTokens: providerUsage.total_tokens ?? p + c,
      source: "provider",
    };
  }
  const promptTokens = messages ? countMessagesTokens(messages) : countTextTokens(promptText ?? "");
  const completionTokens = countTextTokens(outputText ?? "");
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    source: "estimated",
  };
}
