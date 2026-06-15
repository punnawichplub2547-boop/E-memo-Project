// Defense-in-depth against open-redirect. A notification's `action_url` is a
// free-form column, so before using it for navigation we reduce ANY value to a
// same-origin internal path (pathname + search + hash) and drop non-http(s)
// schemes entirely. External absolute URLs keep only their path — navigation
// stays inside the app, never redirecting to another origin.
export function toSafeInternalPath(
  url: string | null | undefined,
  origin: string,
): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = `${u.pathname}${u.search}${u.hash}`;
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    return null;
  }
}
