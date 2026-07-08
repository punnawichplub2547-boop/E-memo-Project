# Login Brand-Panel Cursor Glow — Design Spec

- **Date:** 2026-07-08
- **Status:** Approved by คุณพลับ (chat, 2026-07-08)
- **Scope:** `/login` left brand panel only (`.em-login-left` in `src/app/login/page.tsx`)
- **Inspiration:** the "moving light in the dark" feel of andersonmancini.dev, translated to a lightweight CSS/JS effect (explicitly NOT WebGL/three.js)

## Goal

When the user moves the mouse over the left blue brand panel on the login page, a soft blue light follows the cursor and brightens the dot-grid texture it passes over. The right form pane is completely unaffected. The effect is decorative polish only — no functional behavior changes.

## Behavior

1. **Glow orb:** a ~340px soft radial blue light (heavily blurred radial-gradient, subtle opacity) positioned inside the panel.
2. **Trailing easing:** the orb does not snap to the cursor. Each animation frame it moves a fraction of the remaining distance toward the cursor (lerp, factor ≈ 0.12/frame at 60fps), producing a floating-light lag.
3. **Dot-grid reveal:** a second copy of the panel's existing dot-grid layer, with brighter dots, masked by a radial mask centered on the glow position (CSS variables `--glow-x`/`--glow-y`). Dots visibly brighten as the light passes.
4. **Enter/leave:** glow fades in (~0.3s) when the pointer enters the panel and fades out (~0.6s) when it leaves; the last position freezes during fade-out.
5. **Containment:** the panel already has `overflow: hidden`; the glow can never render over the right form pane. Layers are `aria-hidden` and sit in the existing `zIndex: 0` decoration band, below panel content (`zIndex: 1`).

## Architecture

| Unit | Responsibility |
|---|---|
| `src/lib/cursor-glow.ts` (new, pure) | Math only: `stepTowards(current, target, factor)` lerp with snap-to-target epsilon, and a bounds clamp for pointer coordinates. No DOM. Unit-tested. |
| `src/app/login/_components/CursorGlow.tsx` (new, client component) | Renders the two decoration layers; owns pointer listeners + one rAF loop; writes `transform: translate3d` and `--glow-x`/`--glow-y` via refs (zero React re-renders on mousemove). Mounted inside `.em-login-left` next to the streak/orb divs. |
| `src/app/login/page.tsx` (edit) | Insert `<CursorGlow />` in the left panel; append glow CSS rules to the page's existing `<style>` block, following the streak/orb conventions. |

## Guardrails

- **Performance:** rAF loop runs only while active (pointer inside, or fade-out incomplete); stops itself afterward. Mousemove handlers only update a target ref.
- **Touch/mobile:** ≤820px the panel is `display: none` (existing behavior); additionally the component no-ops unless `matchMedia("(pointer: fine)")` matches.
- **Reduced motion:** `prefers-reduced-motion: reduce` → component renders nothing.
- **Cleanup:** listeners and rAF cancelled on unmount. Listeners attach to the panel element, not `window`.
- **No new dependencies.** No three.js, no canvas.

## Testing & Verification

- TDD: `src/lib/cursor-glow.test.ts` covers lerp stepping, epsilon snap, and coordinate clamping (written first, watched fail).
- Gate: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` all green.
- Manual/browser: verify in Chrome — glow trails with lag, dot-grid brightens, fade in/out on enter/leave, nothing renders on the form side, no console errors, reduced-motion disables it.

## Out of Scope

- Mobile/touch variants of the effect.
- Parallax on existing orbs/rings (possible later addition, separate decision).
- Any change to login logic, form, or the manual CTA.
