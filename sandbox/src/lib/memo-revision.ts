import type { RevisionSource, MemoSnapshot } from "./approval";

// Pure type, split out of approval.ts to keep that file under its line-count
// guardrail. Re-exported from approval.ts so existing imports are unaffected.
export type MemoRevision = {
  revisionNo: number;
  source: RevisionSource;
  returnReason?: string;
  rejectReason?: string;
  revisionNote?: string;
  submittedAt: string;
  snapshot: MemoSnapshot;
};
