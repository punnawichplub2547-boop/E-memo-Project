import { describe, expect, it } from "vitest";
import { isFromTelegramIp } from "./ip-allowlist";

describe("isFromTelegramIp", () => {
  it("accepts IPs inside 149.154.160.0/20", () => {
    expect(isFromTelegramIp("149.154.160.0")).toBe(true);
    expect(isFromTelegramIp("149.154.167.41")).toBe(true);
    expect(isFromTelegramIp("149.154.175.255")).toBe(true);
  });
  it("accepts IPs inside 91.108.4.0/22", () => {
    expect(isFromTelegramIp("91.108.4.0")).toBe(true);
    expect(isFromTelegramIp("91.108.7.255")).toBe(true);
  });
  it("rejects IPs just outside the ranges", () => {
    expect(isFromTelegramIp("149.154.176.0")).toBe(false);
    expect(isFromTelegramIp("149.154.159.255")).toBe(false);
    expect(isFromTelegramIp("91.108.8.0")).toBe(false);
    expect(isFromTelegramIp("91.108.3.255")).toBe(false);
  });
  it("rejects unrelated and internal IPs", () => {
    expect(isFromTelegramIp("8.8.8.8")).toBe(false);
    expect(isFromTelegramIp("10.255.255.173")).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(isFromTelegramIp("")).toBe(false);
    expect(isFromTelegramIp("not-an-ip")).toBe(false);
    expect(isFromTelegramIp("149.154.160")).toBe(false);
    expect(isFromTelegramIp("256.1.1.1")).toBe(false);
    expect(isFromTelegramIp("::1")).toBe(false);
  });
});
