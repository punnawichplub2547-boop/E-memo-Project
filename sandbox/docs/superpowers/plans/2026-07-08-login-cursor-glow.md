# Login Brand-Panel Cursor Glow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A soft blue light trails the cursor over the `/login` left brand panel and brightens the dot-grid it passes, with zero effect on the form pane.

**Architecture:** Pure lerp/clamp math in `src/lib/cursor-glow.ts` (unit-tested). A client component `CursorGlow.tsx` renders two `aria-hidden` decoration layers inside `.em-login-left` and drives them with pointer listeners + one self-stopping `requestAnimationFrame` loop, writing `transform`/CSS variables via refs (no React re-renders on mousemove). CSS lives in the login page's existing global `<style>{\`...\`}</style>` block.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, vitest. **No new dependencies.**

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-08-login-cursor-glow-design.md` — follow it exactly.
- Windows machine: use `npm.cmd` (never bare `npm`). Run commands from `D:\Hrproject\sandbox`.
- Effect must no-op for coarse pointers (`pointer: fine` mismatch) and `prefers-reduced-motion: reduce`.
- Decoration layers must be `aria-hidden="true"` and `pointer-events: none`, in the panel's `zIndex: 0` band (below content at `zIndex: 1`).
- Do not touch login logic, form pane, or the manual CTA.
- Gate before final commit: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` all green.

---

### Task 1: Pure math helpers (`stepTowards`, `clampToBounds`)

**Files:**
- Create: `src/lib/cursor-glow.ts`
- Test: `src/lib/cursor-glow.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (Task 2 relies on these exact signatures):
  - `stepTowards(current: number, target: number, factor: number, epsilon?: number): number` — moves `current` a `factor` fraction of the remaining distance toward `target`; returns exactly `target` when the *next* value is within `epsilon` (default `0.5`) of it.
  - `clampToBounds(value: number, max: number): number` — clamps into `[0, max]`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/cursor-glow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stepTowards, clampToBounds } from "./cursor-glow";

describe("stepTowards", () => {
  it("moves a fraction of the remaining distance toward the target", () => {
    // remaining = 100, factor 0.12 → moves 12
    expect(stepTowards(0, 100, 0.12)).toBe(12);
  });

  it("moves toward a target below current (negative direction)", () => {
    expect(stepTowards(100, 0, 0.5)).toBe(50);
  });

  it("snaps exactly to target when the next step lands within epsilon", () => {
    // remaining = 1, factor 0.5 → next = 99.5, within default epsilon 0.5 of 100 → snap
    expect(stepTowards(99, 100, 0.5)).toBe(100);
  });

  it("does not snap when still outside epsilon", () => {
    // remaining = 10, factor 0.5 → next = 95, 5 away from 100 → no snap
    expect(stepTowards(90, 100, 0.5)).toBe(95);
  });

  it("returns target unchanged when already there", () => {
    expect(stepTowards(42, 42, 0.12)).toBe(42);
  });

  it("respects a custom epsilon", () => {
    // next = 95, within epsilon 6 of 100 → snap
    expect(stepTowards(90, 100, 0.5, 6)).toBe(100);
  });
});

describe("clampToBounds", () => {
  it("clamps negative values to 0", () => {
    expect(clampToBounds(-10, 460)).toBe(0);
  });

  it("clamps values above max to max", () => {
    expect(clampToBounds(500, 460)).toBe(460);
  });

  it("passes through in-range values unchanged", () => {
    expect(clampToBounds(120, 460)).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- run src/lib/cursor-glow.test.ts`
Expected: FAIL — cannot resolve `./cursor-glow` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/cursor-glow.ts`:

```ts
// Pure math for the /login brand-panel cursor glow. No DOM here —
// CursorGlow.tsx owns the listeners and rAF loop.

/**
 * Move `current` a `factor` fraction of the remaining distance toward
 * `target`. Snaps exactly to `target` when the next value lands within
 * `epsilon`, so the rAF loop has a precise stop condition.
 */
export function stepTowards(
  current: number,
  target: number,
  factor: number,
  epsilon = 0.5
): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) <= epsilon ? target : next;
}

/** Clamp a panel-local pointer coordinate into [0, max]. */
export function clampToBounds(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- run src/lib/cursor-glow.test.ts`
Expected: PASS — 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/lib/cursor-glow.ts sandbox/src/lib/cursor-glow.test.ts
git commit -m "feat(login): add cursor-glow lerp/clamp helpers"
```

(Repo root is `D:\Hrproject`; paths above are relative to it.)

---

### Task 2: CursorGlow component, CSS, and page integration

**Files:**
- Create: `src/app/login/_components/CursorGlow.tsx`
- Modify: `src/app/login/page.tsx` — (a) import + mount `<CursorGlow />` inside `.em-login-left` right after the three `em-login-streak` divs (~line 444); (b) append CSS to the existing `<style>{\`...\`}</style>` block that starts at line 39.

**Interfaces:**
- Consumes: `stepTowards`, `clampToBounds` from `@/lib/cursor-glow` (Task 1 signatures).
- Produces: `<CursorGlow />` — self-contained client component, no props. Attaches pointer listeners to its **parent element** (must be mounted as a direct child of `.em-login-left`).

- [ ] **Step 1: Create the component**

Create `src/app/login/_components/CursorGlow.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { stepTowards, clampToBounds } from "@/lib/cursor-glow";

const GLOW_SIZE = 340;
const LERP_FACTOR = 0.12;

/**
 * Decorative cursor-trailing light for the /login brand panel.
 * Mount as a direct child of .em-login-left — pointer listeners attach to
 * the parent element so content on top (zIndex 1) still feeds it events
 * via bubbling. Renders nothing visible for coarse pointers or
 * prefers-reduced-motion. No React re-renders on mousemove: one rAF loop
 * writes transform / CSS vars through refs and stops itself when the
 * glow catches up with the cursor.
 */
export function CursorGlow() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const orb = orbRef.current;
    const grid = gridRef.current;
    const panel = wrap?.parentElement;
    if (!wrap || !orb || !grid || !panel) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reducedMotion) return;

    const pos = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let raf = 0;
    let running = false;
    let hasEntered = false;

    const render = () => {
      pos.x = stepTowards(pos.x, target.x, LERP_FACTOR);
      pos.y = stepTowards(pos.y, target.y, LERP_FACTOR);
      orb.style.transform = `translate3d(${pos.x - GLOW_SIZE / 2}px, ${pos.y - GLOW_SIZE / 2}px, 0)`;
      grid.style.setProperty("--glow-x", `${pos.x}px`);
      grid.style.setProperty("--glow-y", `${pos.y}px`);
      if (pos.x === target.x && pos.y === target.y) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(render);
    };

    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };

    const toLocal = (e: PointerEvent) => {
      const rect = panel.getBoundingClientRect();
      target.x = clampToBounds(e.clientX - rect.left, rect.width);
      target.y = clampToBounds(e.clientY - rect.top, rect.height);
    };

    const onEnter = (e: PointerEvent) => {
      toLocal(e);
      if (!hasEntered) {
        // First entry: start at the cursor instead of flying in from (0,0).
        pos.x = target.x;
        pos.y = target.y;
        hasEntered = true;
      }
      wrap.classList.add("is-active");
      kick();
    };

    const onMove = (e: PointerEvent) => {
      toLocal(e);
      kick();
    };

    const onLeave = () => {
      // Fade out via CSS; position freezes wherever the light caught up to.
      wrap.classList.remove("is-active");
    };

    panel.addEventListener("pointerenter", onEnter);
    panel.addEventListener("pointermove", onMove);
    panel.addEventListener("pointerleave", onLeave);
    return () => {
      panel.removeEventListener("pointerenter", onEnter);
      panel.removeEventListener("pointermove", onMove);
      panel.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className="em-cursor-glow-wrap" aria-hidden="true">
      <div ref={orbRef} className="em-cursor-glow-orb" />
      <div ref={gridRef} className="em-cursor-glow-grid" />
    </div>
  );
}
```

- [ ] **Step 2: Add the CSS**

In `src/app/login/page.tsx`, inside the existing `<style>{\`...\`}</style>` block (find the `.em-login-streak` rules near line 94 and add after that section):

```css
        /* ── Cursor glow (left panel decoration) ── */
        .em-cursor-glow-wrap {
          position: absolute; inset: 0; z-index: 0;
          opacity: 0; transition: opacity 0.6s ease;
          pointer-events: none;
        }
        .em-cursor-glow-wrap.is-active { opacity: 1; transition: opacity 0.3s ease; }
        .em-cursor-glow-orb {
          position: absolute; top: 0; left: 0;
          width: 340px; height: 340px; border-radius: 50%;
          background: radial-gradient(circle,
            rgba(96,165,250,0.22) 0%,
            rgba(37,99,235,0.10) 45%,
            transparent 70%);
          will-change: transform;
        }
        .em-cursor-glow-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(191,219,254,0.45) 1px, transparent 1px);
          background-size: 26px 26px;
          -webkit-mask-image: radial-gradient(circle 170px at var(--glow-x, -999px) var(--glow-y, -999px),
            rgba(0,0,0,0.9), transparent 70%);
          mask-image: radial-gradient(circle 170px at var(--glow-x, -999px) var(--glow-y, -999px),
            rgba(0,0,0,0.9), transparent 70%);
        }
```

Notes for the implementer:
- `background-size: 26px 26px` deliberately matches the panel's existing dot-grid layer (page.tsx ~line 450) so bright dots land exactly on top of dim dots.
- The soft radial-gradient falloff plays the "blur" role — do NOT add `filter: blur(...)` (per-frame blur on a moving layer is GPU-expensive for no visible gain here).
- `340px` in `.em-cursor-glow-orb` must equal `GLOW_SIZE` in the component.

- [ ] **Step 3: Mount the component**

In `src/app/login/page.tsx`:

Add the import at the top with the other imports:

```tsx
import { CursorGlow } from "./_components/CursorGlow";
```

Insert the component inside the left panel as a **direct child**, right after the three streak divs (~line 444):

```tsx
          {/* Traveling light streaks */}
          <div className="em-login-streak em-login-streak-1" />
          <div className="em-login-streak em-login-streak-2" />
          <div className="em-login-streak em-login-streak-3" />

          {/* Cursor-trailing light */}
          <CursorGlow />
```

- [ ] **Step 4: Run the full gate**

Run from `D:\Hrproject\sandbox`:
- `npm.cmd test` — Expected: all tests pass (Task 1's 9 tests included; no other suite affected).
- `npm.cmd run lint` — Expected: clean.
- `npm.cmd run build` — Expected: compiles; only the pre-existing middleware→proxy deprecation warning.

- [ ] **Step 5: Verify in a real browser**

Start dev server: `npm.cmd run dev` (from `D:\Hrproject\sandbox`), open `http://localhost:3000/login` in Chrome (Claude-in-Chrome). Verify:
1. Moving the mouse over the left blue panel → a soft blue light trails the cursor with visible easing lag, and dot-grid dots brighten around it.
2. Cursor leaving the panel → glow fades out (~0.6s) and freezes in place; re-entering fades it back in at the cursor.
3. Moving the mouse over the right form pane → nothing renders there; form fields/buttons work normally.
4. The glow passes *under* the logo, headings, and feature list (content stays fully readable).
5. No console errors.
6. DevTools → Rendering → emulate `prefers-reduced-motion: reduce` → reload → no glow at all.

- [ ] **Step 6: Commit**

```bash
git add sandbox/src/app/login/_components/CursorGlow.tsx sandbox/src/app/login/page.tsx
git commit -m "feat(login): cursor-trailing light glow on the brand panel"
```

---

## Self-Review Notes

- Spec coverage: behavior 1–5 → Task 2 Steps 1–3; guardrails (rAF self-stop, pointer:fine, reduced-motion, cleanup, no deps) → Task 2 Step 1 code; testing gate → Task 1 + Task 2 Steps 4–5. One deliberate deviation from spec wording: "heavily blurred radial gradient" is implemented as soft gradient falloff instead of `filter: blur` (perf; noted in Task 2 Step 2). Spec's "renders nothing" for reduced motion is implemented as "renders an inert, permanently-invisible wrapper" to avoid an SSR/hydration mismatch from reading `matchMedia` during render.
- No placeholders; all code complete.
- Type consistency: `stepTowards`/`clampToBounds` signatures identical in Task 1 Produces, Task 1 Step 3, and Task 2 Step 1 usage.
