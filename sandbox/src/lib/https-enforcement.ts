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
