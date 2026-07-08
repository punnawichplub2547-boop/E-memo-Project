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

// Decision (2026-07-08): AI usage stays console/stdout-only for the trial —
// docker logs are sufficient at current volume and quota is enforced at the
// provider side. Revisit (DB table + admin view) only if AI features open up
// to all users or quota/billing disputes need an audit trail.
export function logAiUsage(log: AiUsageLog): void {
  console.log("[AI_USAGE]", JSON.stringify(log));
}
