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
