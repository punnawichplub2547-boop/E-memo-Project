import { NextResponse } from "next/server";

/**
 * Dispatch feature flag.
 *
 * The dispatch backend (tables + API routes) shipped ahead of an agreed spec and
 * has no UI. It stays off unless `DISPATCH_ENABLED=true` is set explicitly, so an
 * unfinished feature is not reachable from a logged-in session.
 */
export function isDispatchEnabled(rawFlag: string | undefined): boolean {
  return rawFlag?.trim().toLowerCase() === "true";
}

/**
 * Returns the response a dispatch route must send when the feature is off, or
 * null when the route may proceed. 404 rather than 403 so a disabled route is
 * indistinguishable from one that was never deployed. Read the env var here, not
 * at module level, so a local `.env.local` change applies on hot-reload.
 */
export function dispatchDisabledResponse(): NextResponse | null {
  if (isDispatchEnabled(process.env.DISPATCH_ENABLED)) {
    return null;
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
