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
