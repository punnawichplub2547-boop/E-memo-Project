// Pure helpers for the topbar quick-search (command-palette) dropdown.
//
// Operates over whatever memos the caller already holds — on the client that is
// useMemos(), which is hydrated through GET /api/memos and therefore already
// role/visibility-scoped per session. So this never widens what a user can see;
// it only ranks/filters the already-visible set.
import type { MemoRecord } from "./approval";
import { approvalLabels } from "./approval";
import { describeCustomStep, describeRouteSummary } from "./custom-route";

/**
 * The lowercased text blob a memo is matched against. Covers what the topbar
 * placeholder promises — memo title, doc number, requester, department,
 * category/subcategory label — PLUS the approver route (current step + full selected
 * route) so searching "MD" / "General Manager" finds memos at that tier.
 *
 * Route entries go through the same describe* helpers the UI renders with, so a
 * custom route contributes the approvers' names rather than its internal
 * "person:<order>#<userId>" tokens: the name is the only form the searcher has
 * ever seen, and the raw token would otherwise make every custom-route memo match
 * the term "person".
 */
export function memoSearchHaystack(m: MemoRecord): string {
  return [
    m.id,
    m.title,
    m.requester,
    m.department,
    approvalLabels[m.category],
    m.itemSubcategoryLabel,
    describeCustomStep(m.currentStep, m.customRoute, m.selectedRoute?.length),
    describeRouteSummary(m.selectedRoute, m.customRoute),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Filter memos for the quick-search dropdown. Whitespace-separated terms are
 * AND-ed (every term must appear somewhere in the haystack). Empty/blank query
 * returns [] (dropdown shows nothing rather than the whole list). Result count
 * is capped by `limit`.
 */
export function quickSearchMemos(
  memos: MemoRecord[],
  query: string,
  limit = 6,
): MemoRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const matched: MemoRecord[] = [];
  for (const m of memos) {
    const hay = memoSearchHaystack(m);
    if (terms.every((t) => hay.includes(t))) {
      matched.push(m);
      if (matched.length >= limit) break;
    }
  }
  return matched;
}
