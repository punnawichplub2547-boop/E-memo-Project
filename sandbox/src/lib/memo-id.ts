/**
 * Generates a memo ID in the format EM-YYYYMMDD-HHMMSS-XXX.
 * Date/time parts are derived from Asia/Bangkok time so IDs are
 * meaningful to Thai users regardless of server runtime timezone.
 * The three-character uppercase hex suffix (000–FFF, 4096 slots)
 * prevents same-second collisions in normal prototype use.
 *
 * @param date    The moment of creation (defaults to now).
 * @param random  A [0, 1) random source (defaults to Math.random).
 *                Inject a deterministic function in tests.
 */
export function generateMemoId(
  date: Date = new Date(),
  random: () => number = Math.random,
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";

  const datePart = `${get("year")}${get("month")}${get("day")}`;
  const timePart = `${get("hour")}${get("minute")}${get("second")}`;
  const suffix = Math.floor(random() * 0x1000).toString(16).toUpperCase().padStart(3, "0");

  return `EM-${datePart}-${timePart}-${suffix}`;
}

/**
 * Shortens a memo ID for a dense list column.
 *
 * A full ID ("EM-20260805-103912-34E") is too wide for the queue's ID column,
 * so the browser wraps it across three lines and the row grows by ~74%. The
 * leading "EM-<date>" is identical on most rows anyway; the tail is what tells
 * them apart. Callers must keep the full ID reachable — as a `title`/aria label
 * on the cell and in full on the detail panel.
 *
 * Only the four-segment current format ("EM-<date>-<time>-<suffix>") has a
 * prefix worth dropping. A legacy three-segment id ("EM-2026-001") is returned
 * whole: its second segment is the YEAR, and dropping it would both lose
 * information and collide across years ("EM-2027-001" → the same "…001").
 * Ids with no separator, or too few segments, are likewise returned unchanged
 * rather than reduced to a bare ellipsis.
 */
export function shortMemoId(id: string): string {
  const parts = id.split("-");
  return parts.length >= 4 ? `…${parts.slice(2).join("-")}` : id;
}
