// Regression check: no horizontal scroll on any page at mobile widths.
// Run with the app running locally:  npm run audit:overflow
// (override target with SANDBOX_URL). Logs in with a seeded admin, then for
// each page at 390/360/320px reports overflow px + the offending elements,
// and confirms the topbar stays sticky. Expect "no overflow on any page".
import { chromium } from "playwright";

const baseUrl = process.env.SANDBOX_URL ?? "http://localhost:3000";
const creds = [
  { email: "admin@car-1996.com", password: "Admincar_1996" },
  { email: "punnawich@car-1996.com", password: "Admin@1234" },
];
const pages = ["/", "/create", "/queue", "/history", "/search", "/report", "/admin", "/profile"];

async function login(page) {
  for (const c of creds) {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', c.email);
    await page.fill('input[type="password"]', c.password);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1000);
    if (!page.url().includes("/login")) return c.email;
  }
  throw new Error("login failed");
}

const widths = [390, 360, 320];
const browser = await chromium.launch({ headless: true });
const result = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  result.loggedInAs = await login(page);

  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 844 });
    const report = [];
    for (const path of pages) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      const data = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const overflow = document.documentElement.scrollWidth - vw;
        const offenders = [];
        if (overflow > 0) {
          document.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > vw + 1 && r.width <= vw + 400) {
              const cls = (el.className && el.className.toString().slice(0, 45)) || "";
              offenders.push({ tag: el.tagName.toLowerCase(), cls, right: Math.round(r.right), w: Math.round(r.width) });
            }
          });
        }
        const seen = {};
        for (const o of offenders) {
          const k = o.tag + "." + o.cls;
          if (!seen[k] || o.right > seen[k].right) seen[k] = o;
        }
        return { overflow, offenders: Object.values(seen).sort((a, b) => b.right - a.right).slice(0, 6) };
      });
      if (data.overflow > 0) report.push({ path, overflowPx: data.overflow, offenders: data.offenders });
    }
    result[`width_${w}`] = report.length ? report : "no overflow on any page";
  }

  // Sticky-topbar sanity at 360px: scroll down, topbar should stay pinned at top.
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(`${baseUrl}/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  result.topbarStickyOk = await page.evaluate(async () => {
    window.scrollTo(0, 600);
    await new Promise((r) => setTimeout(r, 300));
    const tb = document.querySelector(".em-topbar");
    if (!tb) return "no topbar";
    return Math.round(tb.getBoundingClientRect().top); // ~0 means still pinned
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
