// Pure helpers for the topbar quick-search (command-palette) dropdown.
//
// Operates over whatever memos the caller already holds — on the client that is
// useMemos(), which is hydrated through GET /api/memos and therefore already
// role/visibility-scoped per session. So this never widens what a user can see;
// it only ranks/filters the already-visible set.
import type { MemoRecord } from "./approval";
import { approvalLabels } from "./approval";

/**
 * The lowercased text blob a memo is matched against. Covers what the topbar
 * placeholder promises — memo title, doc number, requester, department,
 * category/subcategory label — PLUS the approver route (current step + full selected
 * route) so searching "MD" / "General Manager" finds memos at that tier.
 */
export function memoSearchHaystack(m: MemoRecord): string {
  return [
    m.id,
    m.title,
    m.requester,
    m.department,
    approvalLabels[m.category],
    m.itemSubcategoryLabel,
    m.currentStep,
    m.selectedRoute?.join(" ") ?? "",
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
