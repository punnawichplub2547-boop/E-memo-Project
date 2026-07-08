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
