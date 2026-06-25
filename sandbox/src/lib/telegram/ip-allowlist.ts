// Telegram webhook source ranges (https://core.telegram.org/bots/webhooks).
// Used as defense-in-depth behind the Cloudflare WAF IP rule. IPv4 only —
// Telegram delivers webhooks from these IPv4 blocks.
const TELEGRAM_CIDRS: ReadonlyArray<readonly [base: number, mask: number]> = [
  toCidr("149.154.160.0/20"),
  toCidr("91.108.4.0/22"),
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function toCidr(notation: string): [number, number] {
  const [base, bitsStr] = notation.split("/");
  const baseInt = ipv4ToInt(base);
  const bits = Number(bitsStr);
  if (baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    throw new Error(`Invalid CIDR: ${notation}`);
  }
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [(baseInt & mask) >>> 0, mask];
}

export function isFromTelegramIp(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return TELEGRAM_CIDRS.some(([base, mask]) => ((n & mask) >>> 0) === base);
}
