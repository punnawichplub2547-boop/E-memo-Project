export type FilterOption = { value: string; label: string };

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// Parses the app's display timestamp "DD Mon YYYY HH:MM" (time optional). Locale-independent.
export function parseMemoDate(s: string): Date | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  const d = new Date(Number(m[3]), mon, Number(m[1]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

// days <= 0 → "All time" (always true). Otherwise createdAt must be within the last `days`.
export function isWithinDays(createdAt: string, days: number, now: Date): boolean {
  if (!days || days <= 0) return true;
  const d = parseMemoDate(createdAt);
  if (!d) return false;
  return d.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

// tier "" → matches all; otherwise exact currentStep match.
export function matchesTier(currentStep: string, tier: string): boolean {
  return tier === "" || currentStep === tier;
}

export const DATE_OPTIONS: FilterOption[] = [
  { value: "0", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

// allLabel differs by page ("All levels" on queue, "All approvers" on history).
export function tierOptions(allLabel: string): FilterOption[] {
  return [
    { value: "", label: allLabel },
    { value: "Manager / Top Section", label: "Manager" },
    { value: "General Manager", label: "General Manager" },
    { value: "Managing Director", label: "Managing Director" },
  ];
}
