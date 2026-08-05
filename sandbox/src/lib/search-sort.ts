import { parseMemoDate } from "./memo-filters";

export type SearchSortKey = "relevance" | "newest" | "amount";

/** How many result cards the search page shows before "Load more". */
export const SEARCH_PAGE_SIZE = 8;

export const SEARCH_SORT_TABS: { key: SearchSortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "newest", label: "Newest" },
  { key: "amount", label: "Amount" },
];

type Sortable = { updatedAt: string; amount: number };

/**
 * Orders search results for the sort tabs.
 *
 * "relevance" keeps whatever order the caller produced — the AI ranking in AI
 * mode, the keyword-filter order otherwise — so it stays the neutral default.
 * "newest" reads `updatedAt` because that is the date the result card shows;
 * it is a display string ("17 Jul 2026 15:45"), so it has to be parsed rather
 * than compared as text. Rows with a date we cannot read keep their place at
 * the end instead of disappearing.
 *
 * Always returns a new array — the caller's list is memoised app state.
 */
export function sortSearchResults<T extends Sortable>(results: T[], key: SearchSortKey): T[] {
  if (key === "relevance") return [...results];

  if (key === "amount") {
    return [...results].sort((a, b) => b.amount - a.amount);
  }

  return [...results].sort((a, b) => {
    const aTime = parseMemoDate(a.updatedAt)?.getTime();
    const bTime = parseMemoDate(b.updatedAt)?.getTime();
    if (aTime === undefined && bTime === undefined) return 0;
    if (aTime === undefined) return 1;
    if (bTime === undefined) return -1;
    return bTime - aTime;
  });
}
