# Login Manual-CTA Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "ใช้งานครั้งแรก? ดูคู่มือการใช้งานระบบ" link on the login page (`/login`) read as a clickable helper chip and give it a tasteful one-shot entrance animation plus a hover/focus shimmer reward, so first-time employees notice the public `/manual` page without disturbing returning users who are just signing in.

**Architecture:** Pure CSS change confined to one file. The link's inline `style={{...}}` is replaced with a new `.em-manual-cta` class added to the `<style>{`...`}`</style>` block that `src/app/login/page.tsx` already owns (this page keeps its own scoped keyframes/classes separate from `globals.css`). No new components, no JS state, no new dependencies.

**Tech Stack:** Next.js 16 / React 19 (existing), plain CSS keyframes inside the page's inline `<style>` tag (existing pattern), `globals.css`'s existing `emShimmer` keyframes (reused, not duplicated — `globals.css` is imported once in `src/app/layout.tsx` so its keyframes are available document-wide).

## Global Constraints

- Windows dev commands use `npm.cmd`, never `npm` (from `sandbox/CLAUDE.md`).
- No new npm dependencies — pure CSS.
- No JS/state changes to `src/app/login/page.tsx` — markup and CSS only.
- Entrance animation is one-shot (plays once on page load), never an infinite loop — approved design explicitly rejects continuous icon-bounce as disruptive on a login page.
- `:focus-visible` must receive the identical effect as `:hover` on every rule — keyboard users must not lose the affordance.
- All new animations must be silenced under `@media (prefers-reduced-motion: reduce)` — this page has its own such block at `src/app/login/page.tsx:372-376`; extend that list, don't add a second block.
- Do not touch `src/app/manual/**` — out of scope per the approved spec.
- Do not reuse `.pulse-dot` — rejected in design review (confusable with unread-notification badges).
- Exact values from the spec (`docs/superpowers/specs/2026-07-06-login-manual-cta-animation-design.md`), verbatim:
  - Chip background: `rgba(37, 99, 235, 0.06)`; border: `1px solid rgba(37, 99, 235, 0.14)`; `border-radius: 999px`; `padding: 6px 12px`.
  - Entrance: `emCtaIn 550ms cubic-bezier(0.22, 1, 0.36, 1) 700ms both` (opacity 0→1, `translateY(6px)`→`0`).
  - Icon pulse: `emCtaIconPulse 500ms ease-in-out 900ms both` (scale 1→1.08→1).
  - Hover/focus shimmer: reuse existing `emShimmer` keyframes from `globals.css:207`, `700ms ease-out`, triggered only on `:hover`/`:focus-visible` (not looping).

---

### Task 1: Add `.em-manual-cta` chip + animations, wire it onto the manual link

**Files:**
- Modify: `src/app/login/page.tsx:125-132` (CSS insertion point, right after `.em-login-btn` rules, before `.em-feat`)
- Modify: `src/app/login/page.tsx:372-376` (extend the existing reduced-motion class list)
- Modify: `src/app/login/page.tsx:671-683` (the `<Link href="/manual">` markup)

**Interfaces:**
- Consumes: existing `emShimmer` `@keyframes` from `src/app/globals.css:207` (already global via `src/app/layout.tsx` import — no import statement needed, CSS keyframes are document-global).
- Produces: nothing consumed by other tasks — this is a single self-contained UI task with no downstream code.

- [ ] **Step 1: Add the new CSS block to the page's `<style>` tag**

  Open `src/app/login/page.tsx`. Find this existing block (currently around line 125-132):

  ```tsx
        .em-login-btn {
          transition: transform 150ms, box-shadow 200ms, opacity 150ms;
        }
        .em-login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(37,99,235,0.42) !important;
        }
        .em-login-btn:active:not(:disabled) { transform: translateY(0); }
  ```

  Immediately after the closing `}` of `.em-login-btn:active:not(:disabled)` and before the `.em-feat` block, insert:

  ```tsx

        @keyframes emCtaIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes emCtaIconPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        .em-manual-cta {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          text-decoration: none;
          background: rgba(37, 99, 235, 0.06);
          border: 1px solid rgba(37, 99, 235, 0.14);
          border-radius: 999px;
          padding: 6px 12px;
          animation: emCtaIn 550ms cubic-bezier(0.22, 1, 0.36, 1) 700ms both;
        }
        .em-manual-cta svg {
          animation: emCtaIconPulse 500ms ease-in-out 900ms both;
        }
        .em-manual-cta::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(37,99,235,0.18) 50%, transparent 70%);
          transform: translateX(-100%);
          pointer-events: none;
        }
        .em-manual-cta:hover::after,
        .em-manual-cta:focus-visible::after {
          animation: emShimmer 700ms ease-out;
        }
  ```

  This adds the two new keyframes plus the chip's static shape, one-shot entrance, and the hover/focus shimmer (which reuses `emShimmer` already defined in `globals.css`).

- [ ] **Step 2: Extend the existing reduced-motion block**

  Find the existing block at (currently) line 372-376:

  ```tsx
        @media (prefers-reduced-motion: reduce) {
          .em-login-streak, .em-mobile-atmos .em-orb-top, .em-mobile-atmos .em-orb-bottom,
          .em-mb-logo, .em-car-logo-square, .em-car-logo-square::after,
          .em-car-logo-square img, .em-feat, .em-form-wrap { animation: none !important; }
        }
  ```

  Replace it with (adding the three new selectors to the same list — do not create a second `@media` block):

  ```tsx
        @media (prefers-reduced-motion: reduce) {
          .em-login-streak, .em-mobile-atmos .em-orb-top, .em-mobile-atmos .em-orb-bottom,
          .em-mb-logo, .em-car-logo-square, .em-car-logo-square::after,
          .em-car-logo-square img, .em-feat, .em-form-wrap,
          .em-manual-cta, .em-manual-cta svg, .em-manual-cta::after { animation: none !important; }
        }
  ```

- [ ] **Step 3: Run lint to catch syntax errors early**

  Run: `cd D:\Hrproject\sandbox; npm.cmd run lint`
  Expected: passes with no new errors/warnings introduced by the `<style>` edits.

- [ ] **Step 4: Replace the manual link's inline style with the new class**

  Find (currently at line 671-683):

  ```tsx
              <Link
                href="/manual"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  fontSize: 13, color: "#475569", textDecoration: "none", fontWeight: 600,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2.6c-1.1-.7-2.6-1-4.2-1-.5 0-.9.4-.9.9v8.7c0 .5.4.9.9.9 1.6 0 3.1.3 4.2 1 1.1-.7 2.6-1 4.2-1 .5 0 .9-.4.9-.9V2.5c0-.5-.4-.9-.9-.9-1.6 0-3.1.3-4.2 1Z" stroke="#2563EB" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M8 2.6v9.9" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                ใช้งานครั้งแรก? ดูคู่มือการใช้งานระบบ
              </Link>
  ```

  Replace with:

  ```tsx
              <Link href="/manual" className="em-manual-cta">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2.6c-1.1-.7-2.6-1-4.2-1-.5 0-.9.4-.9.9v8.7c0 .5.4.9.9.9 1.6 0 3.1.3 4.2 1 1.1-.7 2.6-1 4.2-1 .5 0 .9-.4.9-.9V2.5c0-.5-.4-.9-.9-.9-1.6 0-3.1.3-4.2 1Z" stroke="#2563EB" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M8 2.6v9.9" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                ใช้งานครั้งแรก? ดูคู่มือการใช้งานระบบ
              </Link>
  ```

  Text, icon paths, and `href` are unchanged — only `style={{...}}` is replaced by `className="em-manual-cta"`.

- [ ] **Step 5: Run lint again**

  Run: `cd D:\Hrproject\sandbox; npm.cmd run lint`
  Expected: passes, no errors.

- [ ] **Step 6: Run the production build to catch any type/JSX error**

  Run: `cd D:\Hrproject\sandbox; npm.cmd run build`
  Expected: build completes successfully (exit code 0).

- [ ] **Step 7: Visual verification with Playwright (desktop + mobile + reduced-motion + keyboard focus)**

  Start the dev server if it isn't already running: `cd D:\Hrproject\sandbox; npm.cmd run dev` (wait for `✓ Ready`).

  Create a temporary script `scripts/tmp-verify-manual-cta.mjs`:

  ```js
  import { chromium } from "playwright";

  const browser = await chromium.launch({ headless: true });
  try {
    // Desktop: confirm chip renders, entrance animation is present, hover shimmer fires
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktop.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    const chip = desktop.locator(".em-manual-cta");
    await chip.waitFor({ state: "visible" });
    const box = await chip.boundingBox();
    console.log("desktop chip boundingBox:", box);
    await desktop.screenshot({ path: "manual-cta-desktop.png", clip: { x: Math.max(box.x - 20, 0), y: Math.max(box.y - 20, 0), width: box.width + 250, height: box.height + 60 } });

    await chip.hover();
    await desktop.waitForTimeout(750); // let the 700ms shimmer play out
    await desktop.screenshot({ path: "manual-cta-desktop-hover.png", clip: { x: Math.max(box.x - 20, 0), y: Math.max(box.y - 20, 0), width: box.width + 250, height: box.height + 60 } });

    // Keyboard focus parity check
    await chip.focus();
    const outlineVisible = await chip.evaluate(el => getComputedStyle(el, "::after").animationName !== "none");
    console.log("focus-visible triggers shimmer animation-name:", outlineVisible);

    // Mobile: chip must be legible without hover
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    const mobileChip = mobile.locator(".em-manual-cta");
    await mobileChip.waitFor({ state: "visible" });
    await mobile.screenshot({ path: "manual-cta-mobile.png" });

    // Reduced motion: no animation should apply
    const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await reduced.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    const reducedChip = reduced.locator(".em-manual-cta");
    const animName = await reducedChip.evaluate(el => getComputedStyle(el).animationName);
    console.log("reduced-motion chip animation-name (expect 'none'):", animName);

    // WCAG AA contrast check: text color against the new chip background
    const contrast = await desktop.evaluate(() => {
      function luminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }
      // Text: #475569 -> (71,85,105). Chip background rgba(37,99,235,0.06) composited
      // over the login card's white panel -> flatten against white.
      const bgAlpha = 0.06, br = 37, bgc = 99, bb = 235;
      const flatR = br * bgAlpha + 255 * (1 - bgAlpha);
      const flatG = bgc * bgAlpha + 255 * (1 - bgAlpha);
      const flatB = bb * bgAlpha + 255 * (1 - bgAlpha);
      const textLum = luminance(71, 85, 105);
      const bgLum = luminance(flatR, flatG, flatB);
      const lighter = Math.max(textLum, bgLum);
      const darker = Math.min(textLum, bgLum);
      return (lighter + 0.05) / (darker + 0.05);
    });
    console.log("text/chip-background contrast ratio (expect >= 4.5):", contrast);

    console.log("ALL CHECKS RAN");
  } finally {
    await browser.close();
  }
  ```

  Run: `cd D:\Hrproject\sandbox; node scripts/tmp-verify-manual-cta.mjs`

  Expected console output:
  - `desktop chip boundingBox:` with a non-null box (chip rendered)
  - `focus-visible triggers shimmer animation-name:` → `true`
  - `reduced-motion chip animation-name (expect 'none'):` → `none`
  - `text/chip-background contrast ratio (expect >= 4.5):` → a number ≥ `4.5` (WCAG AA for normal-size text)
  - `ALL CHECKS RAN` printed at the end, no thrown errors

  Then view the three screenshots (`manual-cta-desktop.png`, `manual-cta-desktop-hover.png`, `manual-cta-mobile.png`) to confirm the chip looks like a tasteful pill (not a jarring badge), text is fully legible, and it doesn't collide with the "ลงทะเบียน" link above it.

  Delete the temporary script and screenshots afterward (they are verification scratch, not part of the codebase): `cd D:\Hrproject\sandbox; rm -f scripts/tmp-verify-manual-cta.mjs manual-cta-desktop.png manual-cta-desktop-hover.png manual-cta-mobile.png`

- [ ] **Step 8: Commit**

  ```bash
  cd D:\Hrproject\sandbox
  git add src/app/login/page.tsx
  git commit -m "$(cat <<'EOF'
  feat(login): animate the manual-guide link into a noticeable chip

  Static tinted pill carries the visual weight so it works without hover
  (mobile has none); a one-shot entrance (700ms delay) and a hover/focus
  shimmer (reusing globals.css's emShimmer) are pure embellishment on top.
  No infinite loops — a continuously-bouncing icon was rejected in design
  review as disruptive on a page most visitors use just to sign in.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Post-Plan Note

This plan has a single task because the change is one self-contained CSS+markup edit to one file with no separable, independently-reviewable sub-deliverable — splitting it further would create artificial checkpoints (e.g. "CSS with no consumer yet") that add process overhead without adding review value.
