import { describe, it, expect } from "vitest";
import { shouldRedirectToHttps, resolveRedirectHost } from "./https-enforcement";

describe("shouldRedirectToHttps", () => {
  it("redirects when Cloudflare forwarded the request as plain http in production", () => {
    expect(shouldRedirectToHttps("http", "production")).toBe(true);
  });

  it("does not redirect when already forwarded as https", () => {
    expect(shouldRedirectToHttps("https", "production")).toBe(false);
  });

  it("does not redirect outside production (local dev has no TLS at all)", () => {
    expect(shouldRedirectToHttps("http", "development")).toBe(false);
    expect(shouldRedirectToHttps("http", undefined)).toBe(false);
  });

  it("does not redirect when there is no forwarded-proto header (direct access, not behind Cloudflare)", () => {
    // e.g. hitting the container on :3000 directly has no TLS endpoint to redirect to -
    // forcing a redirect here would just break that access path, not fix anything.
    expect(shouldRedirectToHttps(null, "production")).toBe(false);
  });

  it("does not redirect when accessing localhost or 127.0.0.1 even in production", () => {
    expect(shouldRedirectToHttps("http", "production", "localhost")).toBe(false);
    expect(shouldRedirectToHttps("http", "production", "localhost:3000")).toBe(false);
    expect(shouldRedirectToHttps("http", "production", "127.0.0.1")).toBe(false);
    expect(shouldRedirectToHttps("http", "production", "127.0.0.1:3000")).toBe(false);
  });

  it("treats any non-https forwarded value as insecure, case-insensitively", () => {
    expect(shouldRedirectToHttps("HTTP", "production")).toBe(true);
    expect(shouldRedirectToHttps("", "production")).toBe(true);
  });
});

describe("resolveRedirectHost", () => {
  // Found live on prod (2026-07-07): req.nextUrl.clone() resolved to the
  // container's own bind address "0.0.0.0:3000" (compose.yaml's HOSTNAME/PORT
  // env vars for the standalone server), not the public hostname - Next.js
  // standalone mode doesn't reliably derive request.nextUrl's host from the
  // incoming Host header behind a reverse proxy. The redirect fired (308) but
  // sent browsers to an unreachable "https://0.0.0.0:3000/login". Must build
  // the redirect target from request headers instead of req.nextUrl.host.
  it("prefers x-forwarded-host over the raw host header", () => {
    expect(resolveRedirectHost("memo.car-1996.com", "0.0.0.0:3000")).toBe("memo.car-1996.com");
  });

  it("falls back to the host header when x-forwarded-host is absent", () => {
    expect(resolveRedirectHost(null, "memo.car-1996.com")).toBe("memo.car-1996.com");
  });

  it("returns null when neither header is present (caller must not redirect)", () => {
    expect(resolveRedirectHost(null, null)).toBe(null);
  });
});
