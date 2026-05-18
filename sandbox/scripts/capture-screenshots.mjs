import { chromium } from "playwright";

const baseUrl = process.env.SANDBOX_URL ?? "http://localhost:3001";

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1
  });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.fill('input[aria-label="Search memo"]', "แม่พิมพ์");
  await desktop.screenshot({
    path: "dashboard-screenshot.png",
    fullPage: false
  });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 1000 },
    isMobile: true
  });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: "dashboard-mobile-screenshot.png",
    fullPage: false
  });

  const searchResultCount = await desktop
    .locator("text=ปรับราคาแม่พิมพ์งานตัวอย่าง")
    .count();

  console.log(
    JSON.stringify(
      {
        baseUrl,
        title: await desktop.title(),
        searchResultVisible: searchResultCount > 0,
        desktop: "dashboard-screenshot.png",
        mobile: "dashboard-mobile-screenshot.png"
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
