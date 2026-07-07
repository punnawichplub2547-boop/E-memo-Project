// The Node process behind cloudflared only ever sees a plain-HTTP socket, so
// req.nextUrl.protocol is always "http:" and can't tell us what the client
// actually connected with. Cloudflare forwards the real client-facing scheme
// via x-forwarded-proto — trust it the same way ip-allowlist.ts already
// trusts Cloudflare's cf-connecting-ip for the Telegram webhook.
//
// Why this exists: the session cookie is always set with the Secure attribute
// in production (see shouldUseSecureCookie() in api/auth/login/route.ts), and
// every RFC 6265-compliant browser is required to silently drop a Secure
// cookie received over plain HTTP. Without this redirect, anyone who reaches
// the app over http:// (an old bookmark, a link shared without an explicit
// https:// scheme) gets bounced back to /login forever even after a correct
// password, because the session cookie from that login never actually gets
// stored.
export function shouldRedirectToHttps(
  forwardedProto: string | null,
  nodeEnv: string | undefined,
): boolean {
  if (nodeEnv !== "production") return false;
  if (forwardedProto === null) return false;
  return forwardedProto.toLowerCase() !== "https";
}

// Do NOT build the redirect target from req.nextUrl.host - in Next.js
// standalone mode (compose.yaml sets HOSTNAME=0.0.0.0 / PORT=3000 for the
// server's own bind address), request.nextUrl resolved to that bind address
// instead of the public hostname when running behind cloudflared, sending
// browsers to an unreachable "https://0.0.0.0:3000". x-forwarded-host is the
// proxy's explicit signal of the original hostname; the raw Host header is
// the fallback for a direct/simpler proxy that doesn't set it.
export function resolveRedirectHost(
  forwardedHost: string | null,
  hostHeader: string | null,
): string | null {
  return forwardedHost ?? hostHeader ?? null;
}
