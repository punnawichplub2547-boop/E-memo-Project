// Governs whether MemoProvider may keep in-memory seed/demo memos when
// GET /api/memos fails with a 5xx or network error (DB unavailable).
// Dev convenience only: a production build must never show demo data on a
// DB outage — it falls back to an empty workspace instead.
export function allowSeedFallbackOnDbError(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
