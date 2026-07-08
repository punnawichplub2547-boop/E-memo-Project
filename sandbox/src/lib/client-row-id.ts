// Client-side unique row IDs for dynamic form rows (request items, vendor rows).
// Replaces String(Date.now()) IDs, which collide when rows are added in the same
// millisecond (rapid clicks, PDF-import loops). Uses crypto.randomUUID when the
// runtime provides it; otherwise falls back to timestamp + random + a module
// counter so even same-millisecond calls stay unique.
let fallbackCounter = 0;

export function newClientRowId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  fallbackCounter += 1;
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${fallbackCounter.toString(36)}`;
}
