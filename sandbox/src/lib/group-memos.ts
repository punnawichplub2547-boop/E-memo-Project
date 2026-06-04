export type DateGroup<T> = { date: string; items: T[] };

/**
 * Groups an array of items by the date portion of their `updatedAt` field
 * ("DD Mon YYYY HH:MM" → key "DD Mon YYYY").  Uses a Map so items with the
 * same date key are always collected into the correct bucket regardless of
 * their order in the input array.  Group order follows first-seen date.
 */
export function groupMemosByDate<T extends { updatedAt: string }>(
  items: T[],
): DateGroup<T>[] {
  const groups: DateGroup<T>[] = [];
  const byDate = new Map<string, DateGroup<T>>();
  for (const item of items) {
    const d = item.updatedAt.split(" ").slice(0, 3).join(" ");
    let group = byDate.get(d);
    if (!group) {
      group = { date: d, items: [] };
      groups.push(group);
      byDate.set(d, group);
    }
    group.items.push(item);
  }
  return groups;
}
