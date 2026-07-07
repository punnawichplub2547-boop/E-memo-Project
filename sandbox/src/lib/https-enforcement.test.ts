import { describe, it, expect } from "vitest";
import { shouldRedirectToHttps } from "./https-enforcement";

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

  it("treats any non-https forwarded value as insecure, case-insensitively", () => {
    expect(shouldRedirectToHttps("HTTP", "production")).toBe(true);
    expect(shouldRedirectToHttps("", "production")).toBe(true);
  });
});
