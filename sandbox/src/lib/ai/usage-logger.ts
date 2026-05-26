export interface AiUsageLog {
  id?: string;
  userId?: string;
  feature: string;
  provider: "thaillm" | "groq";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usageSource: "provider" | "estimated";
  requestStatus: "success" | "error";
  latencyMs: number;
  errorMessage?: string;
  createdAt: string;
}

// TODO: Replace console.log with DB persistence when a database layer is added.
export function logAiUsage(log: AiUsageLog): void {
  console.log("[AI_USAGE]", JSON.stringify(log));
}
