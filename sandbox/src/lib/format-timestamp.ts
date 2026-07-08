/**
 * Produces a locale-punctuation-free timestamp string: "22 May 2026 17:18".
 * Uses formatToParts so the output is immune to ICU/locale punctuation changes
 * (e.g. en-GB with combined date+time options inserts a comma after the year
 * in modern V8, which breaks string-split grouping in history/page.tsx).
 *
 * This is the canonical memo display timestamp format used by the client state,
 * seed memos, and DB serializers.
 */
export function formatTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`;
}
