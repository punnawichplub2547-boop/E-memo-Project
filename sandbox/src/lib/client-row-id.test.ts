import { afterEach, describe, expect, it, vi } from "vitest";
import { newClientRowId } from "./client-row-id";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newClientRowId", () => {
  it("returns a non-empty string", () => {
    const id = newClientRowId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique ids across rapid successive calls", () => {
    const ids = Array.from({ length: 1000 }, () => newClientRowId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid-from-crypto" });
    expect(newClientRowId()).toBe("fixed-uuid-from-crypto");
  });

  it("still returns unique ids when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const ids = Array.from({ length: 1000 }, () => newClientRowId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
