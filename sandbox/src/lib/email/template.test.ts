import { afterEach, describe, expect, it, vi } from "vitest";
import { wrapEmailHtml, wrapEmailText } from "./template";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("wrapEmailText", () => {
  it("keeps the inner body and appends the CAR signature + disclaimer", () => {
    const out = wrapEmailText("เนื้อหาแจ้งเตือน\nบรรทัดสอง");
    expect(out).toContain("เนื้อหาแจ้งเตือน");
    expect(out).toContain("Thank you and Best Regards,");
    expect(out).toContain("Complete Auto Rubber Manufacturing Co.,Ltd.");
    expect(out).toContain("700/498 M.7, T.Donhualoh");
    expect(out).toContain("punnawich@car-1996.com");
    expect(out).toContain("www.c-autorubber.com");
    expect(out).toContain("Please consider the environment before printing this email");
    expect(out).toContain("confidential");
  });
});

describe("wrapEmailHtml", () => {
  it("produces a full HTML document embedding the inner HTML verbatim", () => {
    const out = wrapEmailHtml("<b>รออนุมัติ</b><br>EM-1");
    expect(out).toMatch(/<html/i);
    expect(out).toMatch(/<\/html>/i);
    expect(out).toContain("<b>รออนุมัติ</b><br>EM-1");
  });

  it("includes the branded signature block and confidentiality disclaimer", () => {
    const out = wrapEmailHtml("<p>hi</p>");
    expect(out).toContain("Thank you and Best Regards,");
    expect(out).toContain("Complete Auto Rubber Manufacturing Co.,Ltd.");
    expect(out).toContain("038-454-106-108");
    expect(out).toContain("c-autorubber.com");
    expect(out).toContain("Please consider the environment before printing this email");
    expect(out).toContain("strictly prohibited");
  });

  it("renders the CAR logo image when APP_PUBLIC_BASE_URL is set", () => {
    vi.stubEnv("APP_PUBLIC_BASE_URL", "https://memo.car-1996.com/");
    const out = wrapEmailHtml("<p>hi</p>");
    expect(out).toContain('src="https://memo.car-1996.com/CARLOGO.png"');
  });

  it("falls back to a text wordmark when no base URL is configured", () => {
    vi.stubEnv("APP_PUBLIC_BASE_URL", "");
    const out = wrapEmailHtml("<p>hi</p>");
    expect(out).not.toContain("CARLOGO.png");
    expect(out).toContain("Complete Auto Rubber");
  });
});
