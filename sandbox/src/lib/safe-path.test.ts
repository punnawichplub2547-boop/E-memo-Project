import { describe, expect, it } from "vitest";
import { toSafeInternalPath } from "./safe-path";

const ORIGIN = "https://ememo.car-1996.com";

describe("toSafeInternalPath", () => {
  it("keeps a relative internal path with query", () => {
    expect(toSafeInternalPath("/queue?memo=EM-2026-012", ORIGIN)).toBe("/queue?memo=EM-2026-012");
  });

  it("reduces a same-origin absolute URL to its path", () => {
    expect(toSafeInternalPath(`${ORIGIN}/queue?memo=X`, ORIGIN)).toBe("/queue?memo=X");
  });

  it("reduces an external absolute URL to its path (no cross-origin redirect)", () => {
    expect(toSafeInternalPath("https://intranet-implied.trycloudflare.com/queue", ORIGIN)).toBe("/queue");
  });

  it("downgrades a protocol-relative URL to an internal path", () => {
    expect(toSafeInternalPath("//evil.com/queue", ORIGIN)).toBe("/queue");
  });

  it("rejects javascript: scheme", () => {
    expect(toSafeInternalPath("javascript:alert(1)", ORIGIN)).toBeNull();
  });

  it("rejects data: scheme", () => {
    expect(toSafeInternalPath("data:text/html,<script>", ORIGIN)).toBeNull();
  });

  it("returns null for empty / nullish input", () => {
    expect(toSafeInternalPath(null, ORIGIN)).toBeNull();
    expect(toSafeInternalPath(undefined, ORIGIN)).toBeNull();
    expect(toSafeInternalPath("", ORIGIN)).toBeNull();
  });
});
