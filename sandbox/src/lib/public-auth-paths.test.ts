import { describe, it, expect } from "vitest";
import { isPublicAuthPath } from "./public-auth-paths";

describe("isPublicAuthPath", () => {
  it("treats the auth entry pages as public (no forced login redirect)", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/register")).toBe(true);
    expect(isPublicAuthPath("/forgot-password")).toBe(true);
    expect(isPublicAuthPath("/reset-password")).toBe(true);
  });

  it("treats protected app pages as non-public", () => {
    expect(isPublicAuthPath("/")).toBe(false);
    expect(isPublicAuthPath("/queue")).toBe(false);
    expect(isPublicAuthPath("/profile")).toBe(false);
  });
});
